import Otp from '#models/otp'
import User from '#models/user'
import { cuid } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { differenceInMinutes } from "date-fns"
import jwt from "jsonwebtoken"
import drive from '@adonisjs/drive/services/main'
import SubscriptionsController from './subscriptions_controller.js'
import Merchant from '#models/merchant'
import Config from '#models/config'
import PaymentAccount from '#models/payment_account'

export default class AuthController {
    async otpVerificationPhone({ request, i18n, response }: HttpContext) {
        const validator = vine.compile(vine.object({
            phone: vine.string().regex(/^\+22901[0-9]{8}/),
            deviceId: vine.string().uuid(),
            changeDevice: vine.boolean().optional()
        }))
        request.updateBody({
            ...request.body()
            , deviceId: request.header("x-device-id")
        })
        const data = await request.validateUsing(validator)
        try {
            const otpHash = Math.floor(100000 + Math.random() * 900000).toString()
            const otp = await Otp.firstOrNew({ "phone": data.phone }, {
                phone: data.phone,
                otpHash: otpHash,
                deviceId: request.header("x-device-id")
            })
            const user = await User.query().where("phone", data.phone).first()
            if (otp) {
                if (((user && user.lastDevice != otp.deviceId) || otp.deviceId != request.header("x-device-id") && !data.changeDevice)) {
                    return response.status(400).json({
                        message: i18n.t("NEW_PHONE_ERROR")
                    })
                }
            }
            if (!otp.expiredAt || otp.expiredAt.toMillis() <= DateTime.now().toMillis()) {
                const baseTimeDuration = 3
                otp.deviceId = request.header("x-device-id")!
                otp.expirationDurationMs = otp.expirationDurationMs ? otp.expirationDurationMs + baseTimeDuration : baseTimeDuration;
                otp.expiredAt = DateTime.now().plus({ minutes: otp.expirationDurationMs })
                const otpToken = jwt.sign({ phone: data.phone, deviceId: otp.deviceId }, process.env.JWT_SECRET!, {
                    expiresIn: "24h"
                })
                if (data.changeDevice && user) {
                    user!.lastDevice = request.header("x-device-id")!
                    await user.save()
                }
                await otp.save()
                await this.sendOtpCode(otp)
                return {
                    message: i18n.t("Un code à 6 chiffres vous a été envoyé."),
                    retryAt: otp.expiredAt,
                    otpToken
                }
            } else {
                const diffDate = differenceInMinutes(otp.expiredAt.toJSDate(), new Date())
                return response.status(400).json({
                    message: i18n.t("Vous devez attendre " + (diffDate + 1) + " min  pour demander un nouveau code"),
                    retryAt: otp.expiredAt
                })
            }


        } catch (e) {
            logger.error("Failed to send OTP verification code to phone number", e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de l'envoie du code. Veuillez rééssayer !")
            })
        }
    }

    async otpConfirmCode(ctx: HttpContext) {
        const validator = vine.compile(vine.object({
            phone: vine.string().regex(/^\+22901[0-9]{8}/),
            otp: vine.number(),
            token: vine.string().jwt()
        }))
        const data = await ctx.request.validateUsing(validator)
        try {
            const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET!)
            if (decoded.phone != data.phone || decoded.deviceId != ctx.request.header("x-device-id")) {
                return ctx.response.status(400).json({
                    message: ctx.i18n.t("Appareil de connexion suspect. Il est possible qu'une autre personne essaie d'accéder à un compte qui ne lui appartient pas. Veuillez nous contacter pour assistance.")
                })
            }
            const otp = await Otp.query().where("phone", data.phone).andWhere("otpHash", data.otp).first()
            if (!otp) {
                return ctx.response.status(400).json({
                    message: ctx.i18n.t("Otp code invalide")
                })
            } else if (otp.expiredAt < DateTime.now()) {
                return ctx.response.status(400).json({
                    message: ctx.i18n.t("Otp expiré")
                })
            }
            otp.verifiedAt = DateTime.now()
            otp.expirationDurationMs = 0
            await otp.save()
            const user = await User.query().where("phone", data.phone).first();
            const activeSubscription = user ? (new SubscriptionsController()).getUserActiveSubscription(user.id) : null
            return {
                message: ctx.i18n.t("Otp code validé"),
                acessToken: user ? await this.logUserIn(user, ctx) : null,
                user: user ? {
                    ...user?.toJSON(),
                    activeSubscription
                } : null,


            }
        } catch (e) {
            logger.error("Failed to confirm OTP code during authentication", e)
            return ctx.response.status(400).json({
                message: ctx.i18n.t("Une erreur lors de la validation du code Otp veillez rééssayer.")
            })
        }
    }



    async createUserAccount(ctx: HttpContext) {
        const validator = vine.compile(vine.object({
            firstname: vine.string().minLength(3),
            lastname: vine.string().minLength(3),
            phone: vine.string().regex(/^\+22901[0-9]{8}/),
            email: vine.string().email(),
            profileImage: vine.file({
                size: "1mb",
                extnames: ["png", "jpeg", "jpg"]
            }).optional(),
            token: vine.string().jwt()
        }))

        const data = await validator.validate(ctx.request.body())
        const decoded: any = jwt.verify(data.token, process.env.JWT_SECRET!)
        if (decoded.phone != data.phone || decoded.deviceId != ctx.request.header("x-device-id")) {
            return ctx.response.status(400).json({
                message: ctx.i18n.t("Appareil de connexion suspect. Il est possible qu'une autre personne essaie d'accéder à un compte qui ne lui appartient pas. Veuillez reprendre ou nous contacter pour assistance.")
            })
        }
        const filename = data.profileImage ? `${cuid()}.${data.profileImage.extname}` : null
        try {
            const otp = await Otp.query().where("phone", data.phone).first()
            if (!otp?.verifiedAt) {
                return ctx.response.status(400).json({
                    message: ctx.i18n.t("Vous devez valider votre numéro pour continuer")
                })
            } else if (otp?.verifiedAt.plus({ hours: 24 }) < DateTime.now()) {
                return ctx.response.status(400).json({
                    message: ctx.i18n.t("Verification otp expiré, veuillez reprendre la vérification pour continuer.")
                })
            }
            let path: string | undefined = `https://ui-avatars.com/api/?name=${data.firstname}+${data.lastname}&background=random`
            if (filename && data.profileImage) {

                await data.profileImage.move(app.makePath('storage/uploads'), {
                    name: filename
                })
                path = "/uploads/" + filename
            }
            const merchant = await Merchant.query()
                .whereRaw("phones LIKE ? COLLATE utf8mb4_bin", [data.phone])
                .first()
            const user = await User.create({
                email: data.email,
                phone: data.phone,
                firstname: data.firstname,
                merchantId: merchant?.id,
                //role: "CLIENT",
                role: merchant ? "CLEANER" : "CLIENT",
                lastDevice: ctx.request.header("x-device-id"),
                imageUrl: path,
                lastname: data.lastname
            })
            const activeSubscription = (new SubscriptionsController()).getUserActiveSubscription(user.id)
            return {
                user: {
                    ...user.toJSON(),
                    merchant,
                    activeSubscription
                }, acessToken: await this.logUserIn(user, ctx)
            }
        } catch (e) {
            logger.error(e)
            if (filename && data.profileImage) {
                await drive.use("fs").delete(app.makePath('storage/uploads', filename))
            }
            logger.error("Failed to register new user account", e)
            return ctx.response.status(400).json({
                message: ctx.i18n.t("Une erreur est survenue lors de la création du compte. Veuillez rééssayer !")
            })

        }
    }

    async logUserIn(user: User, ctx: HttpContext) {

        try {
            const token = await ctx.auth.use("api").createToken(user, [], {
                expiresIn: "30d"
            });
            user.lastDevice = ctx.request.header("x-device-id")!;
            return token.toJSON()
        } catch (error) {
            logger.error("Failed to create authentication token for user login", error);
            throw new Error("Unable to log user in");
        }
    }



    async sendOtpCode(otp: Otp) {
        console.log(otp.otpHash)
    }
}