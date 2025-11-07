import Invoice from "#models/invoice";
import logger from "@adonisjs/core/services/logger";
import { FedaPay } from "./gateways/fedapay_service.js";
import { DateTime } from "luxon";
import PaymentAccount from "#models/payment_account";
import PAYMENT_METHODS from "#config/paymens";
import Payment from "#models/payment";

export class PaymentService {
  static async payInvoice(invoice: Invoice) {
    try {
      await invoice.load("paymentAccount")
      const gateway = PAYMENT_METHODS[invoice.paymentAccount.methodClassName];
      switch (invoice.status) {
        case "PENDING":
        case "CREATED":
        case "FAILED":
          // const result = await gateway.createPayinTransaction(invoice)
          // invoice.paymentHash = result.transactionId;
          // invoice.status = "PENDING";
          // await invoice.save();
          // return result.transactionUrl
          invoice.paymentHash = "JjJrVT0RTIc0DQqoyHlnV41G5JeKGTdc67QtF20"
          invoice.status = "PENDING";
          await invoice.save();
          return "https://process.fedapay.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEwNjc3MTk0NCwiZXhwIjoxNzU5OTIxODAwfQ.Xu__JjJrVT0RTIc0DQqoyHlnV41G5JeKGTdc67QtF20"


        case "SUCCESS":
          throw new Error("Transaction already paid");

        default:
          throw new Error("Unknown transaction status");
      }

    } catch (error) {
      logger.error('Error creating transaction: %s', error)
      throw error;
    }
  }

  static async transfert(payment: Payment) {
    try {

      switch (payment.status) {
        case "CREATED":
        case "FAILED":
          // const gateway = PAYMENT_METHODS[payment.paymentAccount.methodClassName];
          // const result = await gateway.createPayoutTransaction(payment)
          // payment.paymentHash = result.id;
          // payment.status = "PENDING";
          // await payment.save();
          // return payment.paymentHash
          payment.paymentHash = "JjJrVT0RTIc0DQqoyHlnV41G5JeKGTdc67QtF20"
          payment.status = "PENDING";
          await payment.save();
          return payment.paymentHash

        case "SUCCESS":
          throw new Error("Transaction already paid");
        default:
          throw new Error("Unknown transaction status");
      }

    } catch (error) {
      logger.error('Error creating transaction: %s', error)
      throw error;
    }
  }



  static async verifyInvoice(invoiceOrPayment:Invoice|Payment) {
    try {
      if (invoiceOrPayment.status === "PENDING") {
        await (invoiceOrPayment as any).preload("paymentAccount")
        const initialGateway = PAYMENT_METHODS[invoiceOrPayment.paymentAccount.methodClassName];
        const {status, transaction} = await initialGateway.getTransactionStatus(invoiceOrPayment.paymentHash);
        if (status === "FAILED" || status === "SUCCESS") {
          if(transaction && transaction.mode!=invoiceOrPayment.paymentAccount.providerMethodType){
            const correctGateway = await PaymentAccount.findByOrFail({providerMethodType:transaction.mode, methodClassName:invoiceOrPayment.paymentAccount.methodClassName})
            invoiceOrPayment.paymentAccountId=correctGateway.id
          }
          invoiceOrPayment.status = status;
          invoiceOrPayment.paidAt = DateTime.now()
          await invoiceOrPayment.save();
        }
      }
      return invoiceOrPayment
    } catch (error) {
      logger.error('Validating creating transaction: %s', error)
      throw error;
    }
  }
}