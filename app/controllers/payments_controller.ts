import PAYMENT_METHODS, { PAYMENT_ADDRESS_TYPES } from '#config/paymens'
import Config from '#models/config'
import Merchant from '#models/merchant'
import Payment from '#models/payment'
import PaymentAccount from '#models/payment_account'
import PaymentAdress from '#models/payment_adress'
import User from '#models/user'
import { PaymentService } from '#services/payment_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import { Decimal } from 'decimal.js'
import logger from '@adonisjs/core/services/logger'

export default class PaymentsController {
    async addOrEditUserPaymentMethod({ request, auth, response, i18n }: HttpContext) {
        const country = "BJ"
        const data = await request.validateUsing(vine.compile(vine.object({
            id: vine.string().exists(async (_, x) => {
                return !!(await PaymentAdress.find(x))
            }).optional(),
            adress: vine.string(),
            methodType: vine.string().exists(async (_, value) => {
                return !!(PAYMENT_ADDRESS_TYPES[country] as any)[value]
            }),
            fullname: vine.string().minLength(3).maxLength(255)
        })))
        const adress = data.id ? await PaymentAdress.findOrFail(data.id) : new PaymentAdress()
        adress.adressMethodType =  data.methodType as any
        if (PAYMENT_ADDRESS_TYPES[country][adress.adressMethodType].pattern.test(data.adress)) {
            return response.status(400).json({
                message: i18n.t("Format du numéro non correspondant au réseau choisi.")
            })
        }
        try {
            adress.name = data.fullname
            adress.adress = data.adress
            adress.merchantId = auth.user!.merchantId!
            return await adress.save()

        } catch (e) {
            logger.error("Failed to add or update user payment method address", e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de l'enrégistrement de votre adresse. Veuillez réssager")
            })
        }
    }

    async createPayment({ request, auth, response, i18n }: HttpContext) {
        const data = await request.validateUsing(vine.compile(vine.object({
            amoutToSend: vine.number(),
            amout: vine.number(),
            addressId: vine.number().exists(async (_, value, field) => {
                field.value = await PaymentAdress.find(value)
                return !!field.data.addressId
            })
        })))
        console.log(data)
        var tx
        try {
            const paymentAdress: PaymentAdress = data.addressId as any;
            const serviceFeesConfig = await Config.query().where("key", "PAYOUT_SERVICE_FEES_RATE").firstOrFail()
            const paymentMethodAccount = await PaymentAccount.query().where("adressMethodType", paymentAdress.adressMethodType).andWhere("isDefault", 1).andWhere("country", "BJ").firstOrFail()
            const serviceFees = Decimal(data.amout).mul(serviceFeesConfig.value)
            const payoutFees = PaymentAccount.calculateFees(paymentMethodAccount, data.amoutToSend, "payout").feeAmount
            const sentAmount = Decimal(data.amout).minus(serviceFees).minus(payoutFees)

            if (!Decimal(data.amoutToSend).add(serviceFees).add(payoutFees).eq(data.amout)) {
                throw { error: i18n.t("Les montants envoyés et l'évaluation des frais sont invalides.") }
            }
            tx = await db.transaction()
            const merchant = await Merchant.query({ client: tx }).where("id", auth.user!.merchantId!).forUpdate().firstOrFail()
            if (Decimal(merchant?.balance).lt(data.amout)) {
                throw ({
                    error: i18n.t("Votre solde est insuffisant.")
                })
            }
            const payment = await Payment.create({
                //adressId: paymentAdress.id,
                askAmount: data.amout,
                networkFees: payoutFees,
                serviceFees: serviceFees.toNumber(),
                merchantId: auth.user!.merchantId,
                recevingAdress: paymentAdress.adress,
                sentAmount: sentAmount.toNumber(),
                status: "CREATED",
                paymentAccountId:paymentMethodAccount.id,
                userId:auth.user!.id
            }, {
                client: tx
            })
            await tx.commit()
            await payment.preload("paymentAccount")
            // Start payment
            const user: User = auth.user!;
            await user.load("merchant")
            PaymentService.transfert(payment).catch((e)=>{
                console.log("erreur de paiement")
            })
            return payment
        } catch (e: any) {
            logger.error("Failed to process payment transaction", e)
            await tx?.rollback()
            if (e.error) {
                return response.status(400).json({
                    message: e.error
                })
            }else{
                 return response.status(400).json({
                    message: i18n.t("Une erreur est survenuen lors de soumission de la requete. Veuillez tenter à nouveau.")
                })
            }

        }
    }

    async checkPayment(paymentId:string){
        const payment=await Payment.query().where("id", paymentId).preload("paymentAccount").firstOrFail()
        if(payment.status!=="PENDING"){
             throw new Error("Payment déjà statué") 
        }
        const partnerPayment = PAYMENT_METHODS[payment.paymentAccount.methodClassName]
        const partnerPaymentTransactionStatus= payment.paymentHash ? (await partnerPayment.getTransactionStatus(payment.paymentHash)).status : null
        if(!partnerPayment){
            throw new Error("Traitenement impossible avec ce moyen de paiement")
        }else if(!partnerPaymentTransactionStatus){
            throw new Error("Hash de paiement inexistant")
        }
        payment.status=partnerPaymentTransactionStatus
        await payment.save()
        return payment
    }

    async getPayment({ request, auth }: HttpContext) {
        return await Payment.findByOrFail({ id: request.param("paymentId"), merchantId: auth.user!.merchantId })
    }

    async getPayments({ auth }: HttpContext) {
        return await Payment.findManyBy({ merchantId: auth.user!.merchantId })
    }

    async getAddresses({ auth }: HttpContext) {
        return await PaymentAdress.findManyBy({ merchantId: auth.user!.merchantId! })
    }
async getPaymentMethods({ auth }: HttpContext) {
        return await PaymentAccount.findManyBy({ country:"BJ" })
    }

}