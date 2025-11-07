import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import { type BelongsTo } from '@adonisjs/lucid/types/relations'
import Merchant from './merchant.js'

export default class PaymentAdress extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name:string

  @column()
  declare adress:string

  @column()
  declare adressMethodType:"mtnmomo"|"moovmomo"|"celtiscash"

  @column()
  declare merchantId:number

  @belongsTo(()=>Merchant,{
    foreignKey:"id",
    localKey:"merchantId"
  })
  declare merchant:BelongsTo<typeof Merchant>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}