import { DateTime } from 'luxon'
import { afterFetch, afterFind, afterPaginate, BaseModel, beforeSave, column, hasOne } from '@adonisjs/lucid/orm'
import User from './user.js'
import { type HasOne } from '@adonisjs/lucid/types/relations'
import db from '@adonisjs/lucid/services/db'
import type { SimplePaginatorContract } from '@adonisjs/lucid/types/querybuilder'
import Merchant from './merchant.js'
export default class Adress extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quartier: string

  @column()
  declare commune: string

  @column()
  declare arrondissement: string

  @column()
  declare departement: string

  @column()
  declare description: string

  @column()
  declare country: string

  @column()
  declare contactFullname: string

  @column()
  declare contactPhone: string

  @column()
  declare userId: number

  @column()
  declare merchantId?: number

  @column()
  declare coordinates: {
    longitude: string,
    latitude: string
  }

  @hasOne(() => User, {
    foreignKey: "id",
    localKey: "userId"
  })
  declare user: HasOne<typeof User>

  @hasOne(() => Merchant, {
    foreignKey: "id",
    localKey: "merchantId"
  })
  declare merchant: HasOne<typeof Merchant>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static convertCoordBeforeSave(model: Adress) {
    if (model.coordinates && typeof model.coordinates === 'object') {
      const lat = model.coordinates.latitude
      const lng = model.coordinates.longitude
      if (lat !== undefined && lng !== undefined) {
        model.coordinates = db.knexRawQuery(`ST_PointFromText('POINT(${lng} ${lat})')`) as any
      }
    }
  }


  @afterFind()
  static afterFindHook(event: Adress) {
    if ((event.coordinates as any)?.x && (event.coordinates as any)?.y) {
      event.coordinates = {
        latitude: (event.coordinates as any).x,
        longitude: (event.coordinates as any).y,
      }
    }

  }

  @afterFetch()
  static afterFetchHook(adresses: Adress[]) {
    adresses.forEach(Adress.afterFindHook)
  }

  @afterPaginate()
  static afterPaginateHook(adresses: SimplePaginatorContract<Adress>) {
    adresses.forEach(Adress.afterFindHook)
  }

}