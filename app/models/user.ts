import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany, hasOne, manyToMany } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import env from '#start/env'
import { type HasMany, type HasOne, type ManyToMany } from '@adonisjs/lucid/types/relations'
import Merchant from './merchant.js'
import Notification from './notification.js'
import Permission from './permission.js'


export default class User extends BaseModel {

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare lastname: string | null

  @column()
  declare firstname: string | null

  @column()
  declare role: "CLIENT" | "CLEANER" | "ADMIN"

  @column()
  declare email: string | null

  @column()
  declare otpHash: string | null

  @column()
  declare phone: string | null

  @column()
  declare lastDevice: string | null

  @column()
  declare imageUrl: string

  @column()
  declare twoFactorEnabled: boolean | null

  @column({ serializeAs: null })
  declare twoFactorSecret: string | null

  @column({ serializeAs: null })
  declare twoFactorRecoveryCodes: string | null

  @column()
  declare merchantId?: number

  @hasOne(() => Merchant, {
    foreignKey: "id",
    localKey: "merchantId"
  })
  declare merchant: HasOne<typeof Merchant>

  @hasMany(()=>Notification,{
    foreignKey:"userId",
    localKey:"id",
  })
  declare notification:HasMany<typeof Notification>

  @manyToMany(() => Permission, {
    pivotTable: 'user_permissions',
    
  })
  declare permissions: ManyToMany<typeof Permission>

  @computed()
  get imageFullUrl() {
    return this.imageUrl.startsWith("http") ? this.imageUrl : env.get("DOMAINE") + this.imageUrl
  }

  // Helper method to check if user has a permission
  async hasPermission(permissionName: string): Promise<boolean> {
    await this.load('permissions')
    return this.permissions.some(permission => permission.name === permissionName)
  }

  // Helper method to check if user has any of the given permissions
  async hasAnyPermission(permissionNames: string[]): Promise<boolean> {
    await this.load('permissions')
    return this.permissions.some(permission => permissionNames.includes(permission.name))
  }

  // Helper method to check if user has all of the given permissions
  async hasAllPermissions(permissionNames: string[]): Promise<boolean> {
    await this.load('permissions')
    const userPermissionNames = this.permissions.map(p => p.name)
    return permissionNames.every(name => userPermissionNames.includes(name))
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User)
}