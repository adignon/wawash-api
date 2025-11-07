import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Partner extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare phone: string

  @column()
  declare serviceType: 'launderer' | 'pressing' | 'delivery' | 'other'

  @column()
  declare location: string

  @column()
  declare experience: string | null

  @column()
  declare motivation: string

  @column()
  declare status: 'pending' | 'approved' | 'rejected' | 'contacted'

  @column()
  declare adminNotes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
