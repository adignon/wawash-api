import Config from '#models/config'
import Merchant from '#models/merchant'
import Order from '#models/order'
import Payment from '#models/payment'
import PaymentAccount from '#models/payment_account'
import type { HttpContext } from '@adonisjs/core/http'

export default class MerchantsController {
    async getBalanceMerchant({ auth }: HttpContext) {
        const config = await Config.query().where("key", "PAYOUT_SERVICE_FEES_RATE").firstOrFail()
        const merchant = await Merchant.findOrFail(auth.user!.merchantId)
        const payments = await Payment.query().where("merchantId", auth.user!.merchantId!).orderBy("createdAt", "desc").preload("paymentAccount");
        return {
            accounts: await PaymentAccount.query().where("country", "BJ"),
            balance: merchant?.balance,
            serviceFeeRate: config.value,
            payments
        }

    }

    async getMerchantStatistics({ auth, response }: HttpContext) {
        try {
            const data = await Order.query().where('merchantId', auth.user!.merchantId!)
                .andWhere('merchantPaymentStatus', 'REVERSED')
                .count('* as total_orders')
                .sum('merchant_total_cost as total_amount')
                .sum('user_kg as total_user_kg')
                .first()
            console.log(data?.$extras)
            return {
                commandTotal: (data?.$extras.total_orders) ?? 0,
                totalKg: (data?.$extras.total_user_kg) ?? 0,
                incomes: (data?.$extras.total_amount) ?? 0
            }
        } catch (e) {
return response.status(400)
        }
    }
}