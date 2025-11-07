import { DateTime } from 'luxon'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'
import Command from './command.js'
import { type HasOne } from '@adonisjs/lucid/types/relations'
import ServiceAddon from './service_addons.js'

export default class CommandMeta extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commandId: number

  @hasOne(() => Command, {
    foreignKey: "id",
    localKey: "commandId"
  })
  declare command: HasOne<typeof Command>

  @column()
  declare addonId: number

  @column()
  declare value:string|null

  @hasOne(() => ServiceAddon, {
    foreignKey: "id",
    localKey: "addonId"
  })
  declare addon: HasOne<typeof ServiceAddon>
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}