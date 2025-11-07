import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import { type HasOne, type BelongsTo } from '@adonisjs/lucid/types/relations'
import Merchant from './merchant.js'
import PaymentAccount from './payment_account.js'
import User from './user.js'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare askAmount: number

  @column()
  declare sentAmount: number

  @column()
  declare adressId: number

  @column()
  declare paymentHash: string

  @column()
  declare merchantId: number

  @column()
  declare networkFees: number


  @column()
  declare serviceFees: number

  @column()
  declare status: "PENDING" | "SUCCESS" | "FAILED" | "CREATED"

  @column()
  declare comment?: string

  @column()
  declare userId:number

  @column.dateTime()
  declare paidAt:DateTime

  @hasOne(()=>User,{
    foreignKey:"id",
    localKey:"userId"
  })
  declare user:HasOne<typeof User>

  @column()
  declare paymentAccountId: number

  @hasOne(() => PaymentAccount, {
    foreignKey: "id",
    localKey: "paymentAccountId"
  })
  declare paymentAccount: HasOne<typeof PaymentAccount>

  @column()
  declare recevingAdress: string

  @belongsTo(() => Merchant, {
    foreignKey: "id",
    localKey: "merchantId"
  })
  declare merchant: BelongsTo<typeof Merchant>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}