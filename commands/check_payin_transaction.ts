import SubscriptionsController from '#controllers/subscriptions_controller'
import Command from '#models/command'
import Invoice from '#models/invoice'
import { PaymentService } from '#services/payment_service'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
export default class CheckPayinTransaction extends BaseCommand {
  static commandName = 'check:payins'
  static description = ''

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const invoices = await Invoice.findManyBy({ status: "PENDING" })
    const commandController = new SubscriptionsController()
    for (let invoice of invoices) {
      try {
        await PaymentService.verifyInvoice(invoice);
        if (invoice.status == "SUCCESS") {
          const command = await Command.findByOrFail({ invoiceId: invoice.id })
          await commandController.handlePaidCommand(command)
        }
      } catch (e) {
        console.log("Error ", invoice.id)
      }
    }
  }
}