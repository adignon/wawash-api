import { DateTime } from 'luxon'
import { BaseModel, column, computed } from '@adonisjs/lucid/orm'
import { Decimal } from 'decimal.js'

export default class ServiceAddon extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: "PICKING_MULTIPLE" | "SHIPPING" | "REPASSAGE"

  @column()
  declare name: string

  @column()
  declare code: "PICKING_MULTIPLE" | "SHIPPING_DEFAULT" | "SHIPPING_FAST" | "SHIPPING_PRIORITIZED" | "REPASSAGE"



  @column({
  })
  declare price: number

  @column()
  declare value: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}