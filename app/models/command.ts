import { DateTime } from 'luxon'
import { BaseModel, column, computed, manyToMany, hasOne } from '@adonisjs/lucid/orm'
import Package from './package.js'
import { type ManyToMany, type HasOne } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Invoice from './invoice.js'
import ServiceAddon from './service_addons.js'

export default class Command extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commandType: "SUBSCRIPTION" | "COMMAND"


  @column()
  declare commandDescription: string

  @column()
  declare packageId: number

  @column()
  declare orderMinPrice:number

  @column({
    serializeAs: null
  })
  declare merchantKgTotalCost: number

  @column({
    serializeAs: null
  })
  declare merchantKgUnitCost: number

  @column()
  declare deliveryPerDayCost: number

  @column({
    serializeAs: null
  })
  declare deliveryCost: number

  @column()
  declare totalExecution: number

  @column()
  declare totalCost: number

  @column()
  declare margin: number

  @column()
  declare commandSpentKg:number

  @column()
  declare commandKg:number

  @computed()
  get remainingKg(){
    if(this.commandSpentKg && this.commandKg){
      return this.commandKg-this.commandSpentKg
    }
    return null;
  }

  @column.dateTime()
  declare commandStartAt?: DateTime

  @hasOne(() => Package, {
    foreignKey: "id",
    localKey: "packageId"
  })
  declare package: HasOne<typeof Package>

  @column()
  declare isPaid: boolean

  @column()
  declare userId: number

  @hasOne(() => User, {
    foreignKey: "id",
    localKey: "userId"
  })
  declare user: HasOne<typeof User>

  @column()
  declare invoiceId: number

  @hasOne(() => Invoice, {
    foreignKey: "id",
    localKey: "invoiceId"
  })
  declare invoice: HasOne<typeof Invoice>

  @column()
  declare pickingDaysTimes: any

  @manyToMany(() => ServiceAddon, {
    localKey: "id",
    pivotForeignKey: "command_id",
    relatedKey: "id",
    pivotRelatedForeignKey: "addon_id",
    pivotTable: "command_metas",
    pivotColumns: ["value"]
  })
  declare addons: ManyToMany<typeof ServiceAddon>

  @column()
  declare status: "ACTIVE" | "CANCELED"

  @computed()
  get isActive() {
    if (this.startAt && this.endAt) {
      const now = DateTime.now().toMillis()
      return this.startAt.toMillis() <= now && this.endAt.toMillis() > now
    }
    return false
  }

  @column()
  declare price: string

  @column()
  declare multiplePickingAmount:string


  @column.dateTime()
  declare startAt: DateTime

  @column.dateTime()
  declare endAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}