import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Otp extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare phone: string

  @column()
  declare otpHash: string

  @column()
  declare expirationDurationMs:number

  @column()
  declare deviceId:string

  @column.dateTime()
  declare verifiedAt:DateTime

  @column.dateTime()
  declare loginExpiredAt:DateTime|null

  @column.dateTime()
  declare expiredAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}