import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Adress from '#models/adress'
import logger from '@adonisjs/core/services/logger'
import { pickingDayValidator } from '#validators/subscription'
import Command from '#models/command'
import Invoice from '#models/invoice'
import CommandMeta from '#models/command_meta'
import ServiceAddon from '#models/service_addons'
import Package from '#models/package'
import { Decimal } from "decimal.js"
import db from '@adonisjs/lucid/services/db'
import { PaymentService } from '#services/payment_service'
import { DateTime } from 'luxon'
import OrdersController from './orders_controller.js'
import Config from '#models/config'
import Order from '#models/order'
import PaymentAccount from '#models/payment_account'

export default class SubscriptionsController {

    async saveAdress({ i18n, request, response, auth }: HttpContext) {
        const adressVAlidator = vine.compile(vine.object({
            quartier: vine.string().minLength(2),
            commune: vine.string().minLength(2),
            arrondissement: vine.string().minLength(2),
            department: vine.string().minLength(2),
            contactFullname: vine.string().minLength(3),
            contactPhone: vine.string().regex(/^\+22901[0-9]{8}/),
            description: vine.string().optional(),
            coord: vine.object({
                longitude: vine.string(),
                latitude: vine.string()
            }).optional()
        }))
        const data = await request.validateUsing(adressVAlidator)
        try {
            return await Adress.updateOrCreate({ "userId": auth.user!.id }, {
                arrondissement: data.arrondissement,
                commune: data.commune,
                contactFullname: data.contactFullname,
                contactPhone: data.contactPhone,
                departement: data.department,
                country: "BJ",
                quartier: data.quartier,
                userId: auth.user!.id,
                description: data.description,
                coordinates: data.coord ?? undefined
            })
        } catch (e) {
            logger.error(e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de l'enrégistrement de votre adresse. Veuillez rééssayer!")
            })
        }
    }
    async getAdress({ auth }: HttpContext) {
        return await Adress.query().where("userId", auth.user!.id).first()
    }

    async getUserActiveSubscription(userId: any) {
        const data = await Command.query().where("commandType", "SUBSCRIPTION").andWhere("endAt", ">", db.rawQuery("NOW()")).where("status", "ACTIVE").where("userId", userId).where("isPaid", "1").first()
        if (data) {
            await data.preload("invoice")
            await data.preload("package")
        }
        return data
    }

    async subscribe({ request, auth, response, i18n }: HttpContext) {
        let pack: Package | null
        let shippingAddon: ServiceAddon | null
        const data = await request.validateUsing(vine.compile(vine.object({
            packageId: vine.string().exists(async (_, value) => {
                pack = await Package.query().where("id", value).where("isSubscriptable", 1).first()
                return !!pack;
            }),
            prefereredShipping: vine.string().exists(async (_, value) => {
                shippingAddon = await ServiceAddon.query().where("code", value).first()
                return !!shippingAddon;
            }),
            cancelActiveSubscription: vine.boolean(),
            weekDayPicking: vine.array(vine.any().use(pickingDayValidator({ hourOnly: false }))),
            dryingAddon: vine.boolean(),
        })))
        if (!(await Adress.query().where("userId", auth.user!.id).first())) {
            return response.status(400).json({
                message: i18n.t("Vous devez enrégistrer votre addresse pour pouvoir souscrire à un abonnement.")
            })
        }
        let isQuerySaved = false
        const tx = await db.transaction()
         
        try {
            let oldCommand: Command | null = null
            if (oldCommand = await this.getUserActiveSubscription(auth.user!.id)) {
                if (data.cancelActiveSubscription) {
                    await this.cancel(oldCommand)
                } else {
                    return response.status(400).json({
                        message: i18n.t("Vous avez un abonnement en cours. Veuillez l'annuler pour pouvoir souscrire à nouveau.")
                    })
                }
            }
            const COUNT_WEEK=4;
            const description = [pack!.name]
            // Get configured cost
            const merchantKgPrice = await Config.findByOrFail("key", "SERVICE_MERCHANT_COST_PER_KG")
            const deliveryPrice = await Config.findByOrFail("key", "SERVICE_DELIVERY_COST")
            // Delete not started Commands
            await Command.query().andWhere("userId", auth.user!.id).whereNull("endAt").delete()
            // Calculate Addons value
            let shippingPrice: any = 0, repassagePrice: any = 0, multiplePickingPrice: any = 0, len = 0, merchantDryingCost = 0
            const repassageAddon = data.dryingAddon ? await ServiceAddon.query().where("code", "REPASSAGE").first() : null
            const multiplePicking = data.weekDayPicking.length > 1 ? await ServiceAddon.query().where("code", "PICKING_MULTIPLE").first() : null

            shippingPrice = Decimal(shippingAddon!.price).mul(pack!.kg).mul(COUNT_WEEK);

            if (repassageAddon) {
                repassagePrice = Decimal(repassageAddon!.price).mul(pack!.kg).mul(COUNT_WEEK)
                merchantDryingCost = Number(repassageAddon!.value.merchantCost)
                description.push("avec repassage inclus")
            }
            if (shippingAddon!.code.includes("FAST") || shippingAddon!.code.includes("PRIORITIZED")) {
                if (shippingAddon!.code.includes("FAST")) {
                    description.push("et livraison rapide")
                } else {
                    description.push("et livraison en priorité")
                }
            }
            if (multiplePicking && (len = data.weekDayPicking.slice(pack!.paidMultiplePickMin).length)) {
                multiplePickingPrice = Decimal(multiplePicking!.price).mul(len).mul(COUNT_WEEK).toNumber()
            }
            const total = Decimal(pack!.amount).mul(COUNT_WEEK).add(shippingPrice).add(repassagePrice).add(multiplePickingPrice).toString()
            const orderMinPrice = Decimal(total).sub(multiplePickingPrice).div(COUNT_WEEK).toNumber()

            const merchantKgUnitCost = Decimal(merchantKgPrice.value).add(shippingAddon!.value.merchantCost).add(merchantDryingCost).toNumber()
            let merchantKgTotalCost = Decimal(merchantKgUnitCost).mul(pack!.kg).mul(COUNT_WEEK).toNumber()
            let deliveryCost = Decimal(deliveryPrice.value).mul(data.weekDayPicking.length).mul(COUNT_WEEK).toNumber();
            const margin= Decimal(total).minus(merchantKgTotalCost).minus(deliveryCost).toNumber()
            if(Decimal(margin).lte(0)){
                throw new Error("Margin is negative for subscription")
            }
            // 1. Create Invoice
            const paymentMethodAccount = await PaymentAccount.query().andWhere("isDefault", 1).andWhere("country", "BJ").firstOrFail()
            const invoice = await Invoice.create({
                amount: total,
                margin,
                paymentAccountId: paymentMethodAccount.id,
                invoiceType: pack!.isSubscriptable ? "SUBSCRIPTION_LAUNDRY" : "COMMAND_LAUNDRY",
                status: "CREATED",
                userId: auth.user!.id,
            }, {
                client: tx
            })

            // 2. Create Command
            let command = await Command.create({
                userId: auth.user!.id,
                commandKg:Decimal(pack!.kg).mul(COUNT_WEEK).toNumber(),
                commandDescription: description.join(" "),
                commandType: pack!.isSubscriptable ? "SUBSCRIPTION" : "COMMAND",
                packageId: pack!.id,
                price: total,
                pickingDaysTimes: JSON.stringify(data.weekDayPicking),
                invoiceId: invoice.id,
                merchantKgUnitCost,
                merchantKgTotalCost,
                deliveryPerDayCost: Number(deliveryPrice.value),
                deliveryCost,
                multiplePickingAmount:multiplePickingPrice,
                orderMinPrice,
                totalCost: Decimal(merchantKgTotalCost).add(deliveryCost).toNumber(),
                margin
            }, {
                client: tx
            })
            if (shippingAddon!) {
                await CommandMeta.create({
                    addonId: shippingAddon!.id,
                    commandId: command.id,
                }, {
                    client: tx
                })
            }
            if (repassageAddon) {
                await CommandMeta.create({
                    addonId: repassageAddon!.id,
                    commandId: command.id,
                }, {
                    client: tx
                })
            }
            const url = await PaymentService.payInvoice(invoice)

            await tx.commit()

            isQuerySaved = true

            await command.load("invoice")
            return response.json({
                message: i18n.t('Commande créée avec succès.'),
                command,
                paymentUrl: url
            })
        } catch (e) {
            if (!isQuerySaved) {
                await tx.rollback()
            }

            logger.error(e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la soumission de la commande. Veuillez rééssayer!")
            })
        }
    }

    async commandOrder({ request, auth, response, i18n }: HttpContext) {
        let pack: Package | null
        let shippingAddon: ServiceAddon | null
        const data = await request.validateUsing(vine.compile(vine.object({
            packageId: vine.string().exists(async (_, value) => {
                pack = await Package.query().where("id", value).where("isSubscriptable", 0).first()
                return !!pack;
            }),
            prefereredShipping: vine.string().exists(async (_, value) => {
                shippingAddon = await ServiceAddon.query().where("code", value).first()
                return !!shippingAddon;
            }),
            pickingDate: vine.date().after("today"),
            hours: vine.any().use(pickingDayValidator({ hourOnly: true })),
            dryingAddon: vine.boolean(),
        })))
        if (!(await Adress.query().where("userId", auth.user!.id).first())) {
            return response.status(400).json({
                message: i18n.t("Vous devez enrégistrer votre addresse pour pouvoir souscrire à un abonnement.")
            })
        }
        try {

            const description = [pack!.name]
            // Get configured cost
            const merchantKgPrice = await Config.findByOrFail("key", "SERVICE_MERCHANT_COST_PER_KG")
            const deliveryPrice = await Config.findByOrFail("key", "SERVICE_DELIVERY_COST")

            let shippingPrice: any = 0, repassagePrice = 0, addonMerchantCost = 0, merchantCosts: any = {}
            // Repassage Cost
            const repassageAddon = data.dryingAddon ? await ServiceAddon.query().where("code", "REPASSAGE").first() : null
            if (repassageAddon) {
                repassagePrice = Decimal(repassageAddon!.price).toNumber()
                addonMerchantCost += Number(repassageAddon!.value.merchantCost)
                merchantCosts["REPASSAGE"] = {
                    unitCost: repassageAddon!.value.merchantCost,
                    totalCost: 0
                }
                description.push("avec repassage inclus")
            }
            if (shippingAddon!.code.includes("FAST") || shippingAddon!.code.includes("PRIORITIZED")) {
                shippingPrice = shippingAddon!.price
                addonMerchantCost += Number(shippingAddon!.value.merchantCost)
                merchantCosts["SHIPPING"] = {
                    unitCost: shippingAddon!.value.merchantCost,
                    totalCost: 0
                }
                if (shippingAddon!.code.includes("FAST")) {
                    description.push("et livraison rapide")
                } else {
                    description.push("et livraison en priorité")
                }
            }
            const customerOrderKgPrice = Decimal(pack!.amount).add(shippingPrice).add((repassageAddon?.price) ?? 0).toNumber()

            const executionDate = new Date(data.pickingDate)
            executionDate.setHours(0, 0, 0, 0)
            const endExecution = new Date(data.pickingDate)
            const [h, m] = data.hours[1].split(":")
            endExecution.setHours(Number(h) + Number(shippingAddon!.value.timeDurationApprox), Number(m), 0, 0)

            const order = await Order.create({
                executionDuration: Number(shippingAddon!.value.timeDurationApprox),
                executionDate: DateTime.fromJSDate(executionDate),
                pickingHours: JSON.stringify(data.hours),
                deliveryDate: DateTime.fromJSDate(endExecution),
                deliveryType: data.prefereredShipping as any,
                capacityKg: 0,
                orderTitle: description.join(" "),
                commandExecutionIndex: 1,
                orderExecutionIndex: 1,
                status: "CREATED",
                orderType: "COMMAND",
                userId: auth.user!.id,
                packageId: pack!.id,
                addons: JSON.stringify(merchantCosts) as any,
                customerOrderFinalPrice: 0,
                // Costs
                deliveryCost: Number(deliveryPrice!.value),
                merchantKgCost: Decimal(merchantKgPrice.value).add(addonMerchantCost).toNumber(),
                // Customer
                customerOrderKgPrice,
                customerOrderInitialPrice: 0,
            })

            order.orderId = OrdersController.getOrderId(order.id)
            await order.save()

            order.pickingHours = data.hours
            return order
        } catch (e) {

            logger.error(e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la soumission de la commande. Veuillez rééssayer!")
            })
        }
    }

    async checkCommandOrderPayment({ request, auth, response, i18n }: HttpContext) {
        const orderId = request.param("orderId")
        let order: Order | null
        if (!(orderId && (order = await Order.query().where("id", orderId).andWhere("userId", auth.user!.id).preload("invoice").first()))) {
            return response.status(400).json({
                message: i18n.t("Identifiant invalide. Commande non trouvée")
            })
        } else if (order.invoice.status == "SUCCESS") {
            return {
                order
            }
        }
        await PaymentService.verifyInvoice(order.invoice)
        if (["PENDING", "FAILED", "CREATED"].includes(order.invoice.status)) {
            return {
                order,
                paymentUrl: await PaymentService.payInvoice(order.invoice)
            }
        } else {
            return {
                order
            }
        }

    }

    async checkPayment({ request, auth, response, i18n }: HttpContext) {
        try {
            const command = await Command.query().where("id", request.param("commandId")).andWhere("userId", auth.user!.id).preload("invoice").preload("package").first()
            if (!command) {
                throw {
                    message: i18n.t("Identifiant invalide. Commande non trouvée")
                }
            } else if (command.isPaid && command.startAt) {
                return {
                    command
                }
            }

            await PaymentService.verifyInvoice(command.invoice)
            if (command.invoice.status == "SUCCESS") {
                await this.handlePaidCommand(command)
                return {
                    command,
                }
            } else if (request.input('retry') == 1) {
                return {
                    command,
                    paymentUrl: await PaymentService.payInvoice(command.invoice)
                }
            } else {
                return {
                    command
                }
            }
        } catch (e) {
            if (e.error) {
                return response.status(400).json({
                    message: e.error
                })
            }
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de l'envoie du push à nouveau")
            })
        }
    }


    async handlePaidCommand(command: Command) {
        const trx = await db.transaction()
        try {

            const lockedCommand = await Command.query({ client: trx })
                .where('id', command.id)
                .preload('invoice')
                .forUpdate()
                .firstOrFail()

            if (lockedCommand.invoice.status === 'SUCCESS' && lockedCommand.invoice.paidAt && !lockedCommand.startAt) {
                const orderController = new OrdersController()
                const { startDate, endDate } = orderController.getSubscriptionValidityPeriod(lockedCommand.invoice.paidAt!.toJSDate(), lockedCommand.pickingDaysTimes, 48)
                lockedCommand.startAt = lockedCommand.invoice.paidAt
                lockedCommand.endAt = DateTime.fromJSDate(endDate)
                lockedCommand.isPaid = true
                lockedCommand.commandStartAt = DateTime.fromJSDate(startDate)
                lockedCommand.status = "ACTIVE"
                await lockedCommand.save()
            }

            await trx.commit()
            await command.refresh()
            const orderController = new OrdersController()
            await orderController.processNextCommandOrders(command)
            return command
        } catch (err) {
            await trx.rollback()
            throw err
        }
    }

    async cancelActiveSubscription({ request, auth, response, i18n }: HttpContext) {
        try {
            const activeSubscription = await this.getUserActiveSubscription(auth.user!.id)
            if (activeSubscription) {
                await this.cancel(activeSubscription)
                response.status(200)
            } else {
                return response.status(400).json({
                    message: i18n.t("Aucune souscription active trouvée pour vous")
                })
            }

        } catch (e) {

        }
    }

    async cancel(command: Command) {
        if (command.isActive && command.isPaid) {
            command.status = "CANCELED";
            await command.save()
            await Order.query().where("status", "CREATED").where("commandId", command.id).update({
                status: "CANCELED"
            })
        }
    }



}