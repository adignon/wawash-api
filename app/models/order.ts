import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasOne } from '@adonisjs/lucid/orm'
import { type HasOne } from '@adonisjs/lucid/types/relations'
import Command from './command.js'
import User from './user.js'
import Invoice from './invoice.js'
import Package from './package.js'
import Merchant from './merchant.js'


export default class Order extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderId: string

  @column()
  declare pickingHours: any

  @column()
  declare executionDuration: number

  @column()
  declare status: "CREATED" | "STARTED" | "PICKED" | "WASHING" | "DELIVERED" | "READY"

  @column.dateTime()
  declare deliveryDate: DateTime

  @column()
  declare capacityKg: number

  @column()
  declare userKg?: number

  @column()
  declare commandExecutionIndex: number

  @column()
  declare orderExecutionIndex: number

  @column()
  declare addons?: { [x: string]: { unitCost: number, totalCost: number } }

  @column()
  declare merchantKgCost: number

  @column()
  declare deliveryCost: number

  @column()
  declare orderTitle: string

  @column()
  declare customerOrderKgPrice: number

  @column()
  declare customerOrderInitialPrice: number

  @column()
  declare customerOrderFinalPrice: number

  @column()
  declare customerFeesToPay?: number

  @column()
  declare totalCost?: number

  @column()
  declare margin?: number

  @column()
  declare merchantTotalCost?: number

  @column()
  declare deliveryType: "SHIPPING_DEFAULT" | "SHIPPING_FAST" | "SHIPPING_PRIORITIZED"

  @column.dateTime()
  declare executionDate: DateTime

  @column()
  declare orderType: "SUBSCRIPTION" | "COMMAND"

  @column()
  declare commandId?: number

  @hasOne(() => Command, {
    foreignKey: "id",
    localKey: "commandId"
  })
  declare command?: HasOne<typeof Command>

  @column()
  declare userId: number

  @hasOne(() => User, {
    foreignKey: "id",
    localKey: "userId"
  })
  declare user: HasOne<typeof User>

  @column()
  declare packageId: number

  @column()
  declare invoiceId: number

  @hasOne(() => Invoice, {
    foreignKey: "id",
    localKey: "invoiceId"
  })
  declare invoice: HasOne<typeof Invoice>

  @hasOne(() => Package, {
    foreignKey: "id",
    localKey: "packageId"
  })
  declare package: HasOne<typeof Package>

  @column()
  declare merchantPaymentStatus?: "PENDING" | "REVERSED" | null

  @column()
  declare merchantId?: number | null

  @hasOne(() => Merchant, {
    foreignKey: "id",
    localKey: "merchantId"
  })
  declare merchant: HasOne<typeof Merchant>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @computed()
  get hasStarted() {
    if (this.pickingHours?.length && this.executionDate) {
      let startAt = this.executionDate.toJSDate()
      const [h, m] = this.pickingHours[0].split(":")
      return this.status == "CREATED" && DateTime.fromJSDate(startAt).plus({
        hour: Number(h),
        minutes: Number(m)
      }) < DateTime.now()
    }
    return false

  }

}