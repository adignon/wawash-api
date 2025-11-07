import { DateTime } from 'luxon'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'
import PAYMENT_METHODS from '#config/paymens'
import { Decimal } from 'decimal.js';
type TVariableFees = {
  type: "fixed" | "percent";
  from: number;
  to?: number;
  rate: number;
}[]
export default class PaymentAccount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare methodTitle:string

  @column()
  declare adressMethodType: string

  @column()
  declare methodClassName: keyof typeof PAYMENT_METHODS

  @column()
  declare providerMethodType: string

  @column()
  declare isDefault: boolean

  @column()
  declare country: string

  @column()
  declare currency: string

  @column()
  declare methodCode: string

  @column()
  declare balance: number

  @column()
  declare payinFeeType: "VARIABLE" | "UNIQUE" | string

  @column()
  declare payinUniqueFees: number

  @column()
  declare payinVariableFees?: TVariableFees

  @column()
  declare payoutFeeType: "VARIABLE" | "UNIQUE" | string

  @column()
  declare payoutUniqueFees: number

  @column()
  declare payoutVariableFees?: TVariableFees

  @column()
  declare payoutFees: number

  @column()
  declare frozenBalance: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static calculateFees(account: PaymentAccount, amount: string | number, type: "payin" | "payout") {
    const amountDec = new Decimal(amount || 0)
    const feeType = account[`${type}FeeType`]
    const uniqueFee = new Decimal(account[`${type}UniqueFees`] || 0)
    const variableFees = account[`${type}VariableFees`]

    let fee = new Decimal(0)
    var rate = {
      value: 0,
      type: ''
    }
    if (feeType === "UNIQUE") {
      // If fee >= 1 => fixed fee (e.g. 200 XOF)
      // If fee < 1 => percentage (e.g. 0.018 for 1.8%)
      if (uniqueFee.greaterThanOrEqualTo(1)) {
        rate.type = "fixed"
        rate.value = fee.toNumber()
        fee = uniqueFee

      } else {
        rate.type = "percent"
        rate.value = uniqueFee.toNumber()
        fee = amountDec.mul(uniqueFee)
      }
    } else if (feeType === "VARIABLE" && Array.isArray(variableFees)) {
      // VARIABLE fees — pick tier based on amount
      const match = variableFees.find((tier) => {
        const from = new Decimal(tier.from || 0)
        const to = tier.to ? new Decimal(tier.to) : null
        if (to) return amountDec.greaterThanOrEqualTo(from) && amountDec.lessThanOrEqualTo(to)
        return amountDec.greaterThanOrEqualTo(from)
      })

      if (match) {
        rate.type = match.type
        rate.value = match.rate
        if (match.type === "fixed") {
          fee = new Decimal(match.rate)
        } else if (match.type === "percent") {
          fee = amountDec.mul(new Decimal(match.rate))
        }
      }
    }

    return {
      feeAmount: fee.toNumber(),
      ...rate
    }
  }
}