import Payment from '#models/payment'
import { PaymentService } from '#services/payment_service'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class CheckPayoutTransaction extends BaseCommand {
  static commandName = 'check:payouts'
  static description = ''

   static options: CommandOptions = {
      startApp: true,
    }
  
    async run() {
      const payments = await Payment.findManyBy({ status: "PENDING" })
      for (let payment of payments) {
        try {
          await PaymentService.verifyInvoice(payment);
        } catch (e) {
          console.log("Error ", payment.id)
        }
      }
    }
}