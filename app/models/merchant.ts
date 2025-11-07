import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { type HasMany } from '@adonisjs/lucid/types/relations'
import Adress from './adress.js'

export default class Merchant extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare balance:number

  @column()
  declare washingType:"MANUAL"|"MACHINE"

    @column()
  declare frozenBalance:number

  @column({
    prepare: (value: any) => {
      if (typeof (value) == "string") return value
      try {
        return Array.isArray(value) ? value.join(",") : value
      } catch {
        return ""
      }
    },
    consume: (value: any) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      }
      return []

    },
  })
  declare phones: string[]

  @hasMany(() => Adress, {
    foreignKey: "merchantId",
    localKey: "id"
  })
  declare addresses: HasMany<typeof Adress>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}