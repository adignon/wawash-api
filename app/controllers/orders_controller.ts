import Command from '#models/command';
import Order from '#models/order';
import db from '@adonisjs/lucid/services/db';
import { TransactionClientContract } from '@adonisjs/lucid/types/database';
import { addHours } from 'date-fns';
import { DateTime } from 'luxon';
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine';
import { Decimal } from 'decimal.js';
import env from '#start/env';
import Invoice from '#models/invoice';
import { createHash } from 'crypto';
import PaymentAccount from '#models/payment_account';
import logger from '@adonisjs/core/services/logger';

export default class OrdersController {

    async getOrder({ request, auth, response, i18n }: HttpContext) {
        const order = await Order.query()
            .where("id", request.param("orderId"))
            .if(auth.user?.role == "CLEANER", q => {
                q.where("merchantId", auth.user!.merchantId!)
            })
            .if(auth.user?.role == "CLIENT", q => {
                q.where("userId", auth.user!.id)
            })
            .first()
        if (order?.invoiceId) {
            await order.load("invoice")
        }
        return order
    }

    static getOrderId(id: number) {
        const salt = env.get("APP_KEY");
        const input = salt + id;
        const hash = createHash("sha256").update(input).digest("hex");
        return hash.substring(0, 6).toUpperCase(); // 6-char uppercase code
    }

    async getOrderHistories({ request, auth, response, i18n }: HttpContext) {
        const orders = await Order.query()
            .if(auth.user?.role == "CLEANER", q => {
                q.where("merchantId", auth.user!.merchantId!)
            })
            .if(auth.user?.role == "CLIENT", q => {
                q.where("userId", auth.user!.id)
            })
            .preload("package");
        const ordersData = []
        for (let order of orders) {
            let orderData = order.toJSON()
            if (order.invoiceId) {
                orderData.invoice = await Invoice.find(order.invoiceId)
            }
            ordersData.push(orderData)
        }
        return ordersData
    }

    async createNextOrder(command: Command, { executionDate, pickingHours, commandExecutionIndex, orderExecutionIndex }: {
        executionDate: Date, pickingHours: [string, string], commandExecutionIndex: number, orderExecutionIndex: number
    }, tx: TransactionClientContract) {
        if (!executionDate || !pickingHours) {
            throw new Error("Date et horaire d'exécution de la commande inexistante ou invalide. Veuillez contacter le client pour mettre à jour les informations.")
        }
        //Default values
        var orderShippingDuration: number | null = null
        var orderShippingType: string | null = null
        var deliveryCost = command.deliveryPerDayCost
        var addonsKgCost = 0
        var addonsTotalKgCost = 0
        var merchantCosts: any = {}
        command.addons.forEach((addon) => {
            switch (addon.key) {
                case "SHIPPING": {
                    orderShippingDuration = Number(addon.value.timeDurationApprox)
                    orderShippingType = addon.code
                    addonsTotalKgCost += Decimal(addon.price).mul(command.package.kg).toNumber()
                    addonsKgCost += Decimal(addon.price).toNumber()
                    merchantCosts["SHIPPING"] = {
                        unitCost: addon.value.merchantCost,
                        totalCost: 0
                    }

                    break;
                }
                case "REPASSAGE": {
                    addonsTotalKgCost += Decimal(addon.price).mul(command.package.kg).toNumber()
                    addonsKgCost += Decimal(addon.price).toNumber()
                    merchantCosts["REPASSAGE"] = {
                        unitCost: addon.value.merchantCost,
                        totalCost: 0
                    }
                    break;
                }

            }
        })
        if (!(orderShippingDuration && orderShippingType && deliveryCost)) {
            throw new Error("Données non valide")
        }
        // Set user defined max delivery hours
        const pickingEndAt = new Date(executionDate.toString())
        const [_, endTime] = pickingHours
        const [h, m] = endTime.split(":").map(Number)
        pickingEndAt.setHours(Number(h))
        pickingEndAt.setMinutes(Number(m))
        const maxDeliveryDateTime = addHours(pickingEndAt, orderShippingDuration)

        // Date d'exécution de la command
        // Heure tranche de prise de la command
        // Heure de livraison espérée de la command
        // Type de livraison choisie de la command
        // Prix d'exécution de la commande
        // Niveau d'exécution actuelle de l'ordre
        // status
        const customerKgPrice = Decimal(Decimal(command.package.amount).div(command.package.kg)).add(addonsKgCost).toNumber()
        const customerOrderInitialPrice = Decimal(customerKgPrice).mul(command.package.kg).toNumber()
        if (!Decimal(customerOrderInitialPrice).eq(command.orderMinPrice)) {
            throw Error("Le prix unitaire par commande est différent. Prix unitaire de l'ordre initial:" + command.orderMinPrice + ", Prix unitaire de l'ordre pendant execution: " + customerOrderInitialPrice)
        }
        const order = await Order.create({
            commandId: command.id,
            executionDuration: orderShippingDuration,
            executionDate: DateTime.fromJSDate(executionDate),
            pickingHours: JSON.stringify(pickingHours),
            deliveryDate: DateTime.fromJSDate(maxDeliveryDateTime),
            deliveryType: orderShippingType,
            capacityKg: Number(command.package.kg),
            orderTitle: command.commandDescription,
            commandExecutionIndex: commandExecutionIndex,
            orderExecutionIndex,
            customerOrderFinalPrice: 0,
            status: "CREATED",
            orderType: command.commandType,
            userId: command.userId,
            packageId: command.packageId,
            addons: JSON.stringify(merchantCosts) as any,

            // Costs
            deliveryCost,
            merchantKgCost: command.merchantKgUnitCost,

            // Customer
            customerOrderKgPrice: customerKgPrice,
            customerOrderInitialPrice,



        }, {
            client: tx
        })
        order.orderId = OrdersController.getOrderId(order.id)
        await order.useTransaction(tx).save()
        return order
    }

    async merchantEvaluateOrder({ request, i18n, response, auth }: HttpContext) {
        let order: Order | null
        const isPreview = !!request.input("preview")
        const validator = vine.compile(vine.object({
            orderId: vine.string().exists(async (_, value) => {
                order = await Order.findBy({ "orderId": value.replace("#", ""), status: "CREATED" })
                return !!order
            }),
            kg: vine.number(),
        }))
        const data = await request.validateUsing(validator)

        if (!order!) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        const tx = isPreview ? undefined : await db.transaction()
        try {
            // Load command if this is a subscription order
            let command: Command | undefined | null
            let payForKg = data.kg
            if (order.commandId && (command = await Command.query({ client: tx }).where("id", order.commandId).forUpdate().first())) {
                command.commandSpentKg = Decimal(command.commandSpentKg).add(data.kg).toNumber()
                payForKg = Decimal(command.commandKg).minus(command.commandSpentKg).toNumber()
                payForKg = payForKg > 0 ? 0 : Decimal.abs(payForKg).toNumber()
            }
            order.userKg = data.kg
            order.merchantTotalCost = Decimal(order.merchantKgCost!).mul(data.kg).toNumber()
            order.customerOrderFinalPrice = Decimal(order.customerOrderKgPrice!).mul(data.kg).add(order.commandId ? 0 : order.deliveryCost).toNumber()
            order.customerFeesToPay = Decimal(payForKg).mul(order.customerOrderKgPrice).toNumber()
            order.totalCost = Decimal(order.deliveryCost).add(order.merchantTotalCost).toNumber()
            order.margin = Decimal(order.customerOrderFinalPrice).minus(order.totalCost).toNumber()
            console.log(order.customerFeesToPay)
            if (!isPreview) {
                order.merchantId = auth.user!.merchantId!
                order.status = "WASHING"
                order.merchantPaymentStatus = "PENDING";
            }
            for (let addon in order.addons) {
                order.addons[addon].totalCost = Decimal(order.addons[addon].unitCost).mul(data.kg).toNumber()
            }
            let initials = order.addons!
            if (order.addons) {
                order.addons = JSON.stringify(initials) as any
            }
            let margin = 0
            if (order.customerFeesToPay > 0 && payForKg > 0) {
                const additionnalKg = Decimal(payForKg)
                if (order.commandId && additionnalKg.lte(0)) {
                    throw new Error("Aucun surpoids détecté.")
                }
                const additionnalCost = order.commandId ? Decimal(order.merchantKgCost).mul(additionnalKg) : order.totalCost
                const userAdditionnalAmount = order.commandId ? Decimal(order.customerOrderKgPrice).mul(additionnalKg) : order.customerOrderFinalPrice
                margin = Decimal(userAdditionnalAmount).minus(additionnalCost).toNumber()
                if (margin < 0) {
                    throw new Error("Les frais de surpoids ne couvrent pas les coûts additionnels.")
                }
                const paymentMethodAccount = await PaymentAccount.query().andWhere("isDefault", 1).andWhere("country", "BJ").firstOrFail()
                const lastInvoices = await Invoice.query({
                    client:tx
                }).sum("amount as total").where({
                    userId: order.userId,
                    meta: "order-" + order.id,
                    status: "SUCCESS",
                }).first()
                // Cancel last generated and non paid invoices
                if (!isPreview) {
                    await Invoice.query({
                        client:tx
                    }).where({
                        userId: order.userId,
                        meta: "order-" + order.id,
                        status: "PENDING",
                    }).update({
                        "status": "CANCELED"
                    })
                }
                lastInvoices?.$extras.total
                let amount = order.customerFeesToPay
                if (lastInvoices?.$extras.total && Decimal(order.customerFeesToPay).gt(lastInvoices?.$extras.total)) {
                    amount = Decimal(order.customerFeesToPay).minus(lastInvoices?.$extras.total).toNumber()
                    amount = Decimal(order.customerFeesToPay).minus(lastInvoices?.$extras.total).toNumber()
                }
                let invoice: any = {
                    meta: "order-" + order.id,
                    amount: amount.toString(),
                    invoiceType: order.commandId ? "SUBSCRIPTION_OVERWEIGHT" : "COMMAND_LAUNDRY",
                    status: "CREATED",
                    margin: margin,
                    userId: order.userId,
                    paymentAccountId: paymentMethodAccount.id
                }
                if (!isPreview) {
                    invoice = await Invoice.updateOrCreate({
                        userId: order.userId,
                        meta: "order-" + order.id
                    }, invoice, {
                        client: tx
                    })
                    order.invoiceId = invoice.id
                }


            }
            if (!isPreview && tx) {
                await order.useTransaction(tx).save()
                await command?.useTransaction(tx).save()
                await tx.commit()
            }

            await order.load("package")
            order.addons = initials
            return order!
        } catch (e) {
            logger.error("Failed to update order selection with addons and merchant", e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la sélection de la commandes. Veuillez réssager")
            })
        }
    }

    async merchantOrderAction({ request, auth, i18n, response }: HttpContext) {
        const data = await request.validateUsing(vine.compile(vine.object({
            action: vine.string().in(["WASHED", "REJECTED"]),
            orderId: vine.number().exists(async (_, value) => {
                let order = await Order.findBy({ "id": value, status: "WASHING" })
                return !!order
            }),
        })))
        const tx = await db.transaction()
        let order = await Order.query({ client: tx })
            .where("id", data.orderId)
            .andWhere("status", "WASHING")
            .andWhere("merchantId", auth.user!.merchantId!)
            .first()
        if (!order) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        try {
            if (order.invoiceId) {
                await order.useTransaction(tx).load("invoice")
            }
            order.status = data.action == "WASHED" ? "READY" : "CREATED"
            order.merchantId = data.action == "WASHED" ? order.merchantId : null
            await order.useTransaction(tx).save()
            if (data.action == "REJECTED") {
                if (order.commandId && order.userKg) {
                    await Command.query({ client: tx }).where("id", order.commandId).decrement("commandSpentKg", order.userKg)
                }
                if (order.invoice && order.invoice.status != "SUCCESS") {
                    await Invoice.query({ client: tx }).where("id", order.invoiceId).delete()
                }
            }
            await tx.commit()
        } catch (e) {
            logger.error("Failed to update order status during processing", e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la mise à jour de la commande. Veuillez réssager")
            })
        }
    }

    async customerConfirmOrderReception({ request, auth, i18n, response }: HttpContext) {
        const validator = vine.compile(vine.object({
            orderId: vine.number().exists(async (_, value) => {
                let order = await Order.findBy({ "id": value, status: "READY", userId: auth.user!.id })
                return !!order
            }),
        }))

        const data = await request.validateUsing(validator)
        let order = await Order.query()
            .where("id", data.orderId)
            .andWhere("status", "READY")
            .andWhere("userId", auth.user!.id)
            .first()
        if (!order!) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        try {
            order.status = "DELIVERED"
            order.merchantPaymentStatus = "REVERSED"
            await order.save()
            return order!
        } catch (e) {
            logger.error("Failed to cancel order and reverse payment", e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la validation de la commande. Veuillez réssager")
            })
        }
    }

    async processNextCommandOrders(command: Command, dtx?: any) {
        if (command.totalExecution >= 4) {
            return
        }
        await command.load("addons")
        await command.load("package")
        await command.load("invoice")
        const tx = dtx ?? await db.transaction()
        try {
            let lastExecutionDate = command.commandStartAt!
            let commandExecutionIndex = 0
            for (let i = 0; i < 4; i++) {
                const nextWeekPickups = this.getPickupsDates(lastExecutionDate.toJSDate(), command.pickingDaysTimes, false)
                let j = 0
                let commandExecutionIndex = command.totalExecution + i
                for (let pickup of nextWeekPickups) {
                    j++
                    await this.createNextOrder(command, {
                        commandExecutionIndex: commandExecutionIndex,
                        executionDate: pickup[0] as Date,
                        orderExecutionIndex: j,
                        pickingHours: pickup[2] as [string, string]
                    }, tx)
                }
                lastExecutionDate = DateTime.fromJSDate(nextWeekPickups[nextWeekPickups.length - 1][0] as Date)
            }
            command.totalExecution = commandExecutionIndex
            if (!dtx) await tx.commit()
        } catch (e) {
            console.log(e)
            logger.error("Failed to complete order and finalize command status", e)
            if (!dtx) await tx.rollback()
        }

    }

    getSubscriptionValidityPeriod(paymentDate: Date, pickupDays: [number, [string, string]][], deliveryDelayHours = 48) {

        const nextPickupDates: Date[] = this.getPickupsDates(paymentDate, pickupDays, true).map(d => d[0]) as any
        const firstPickup = nextPickupDates.sort((a, b) => a.getTime() - b.getTime())[0];
        // Début d’abonnement = date du premier ramassage
        const startDate = new Date(firstPickup);
        // Fin d’abonnement = début + 4 semaines
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 28); // 4 semaines
        // Ajout du délai de livraison final (par défaut 48h)
        endDate.setHours(endDate.getHours() + deliveryDelayHours);

        return { startDate, endDate };
    }

    getPickupsDates(
        initialDate: Date,
        pickupDays: [number, [string, string]][],
        includeToday = true
    ) {
        const today = initialDate.getDay();

        return pickupDays.map(([dayIndex, hours]) => {
            // Convert 7 to 0 for Sunday consistency
            const day = dayIndex === 7 ? 0 : dayIndex;

            let daysToAdd = day - today;

            if (daysToAdd < 0) {
                daysToAdd += 7; // If day already passed this week
            } else if (daysToAdd === 0 && !includeToday) {
                daysToAdd = 7; // Same day but we don't include today
            }

            const nextDate = new Date(initialDate);
            nextDate.setDate(initialDate.getDate() + daysToAdd);
            nextDate.setHours(0, 0, 0, 0);

            return [nextDate, dayIndex, hours];
        });



    }

}