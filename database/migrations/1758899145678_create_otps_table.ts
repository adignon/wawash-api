import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'otps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("phone").unique().notNullable()
      table.string("otp_hash").notNullable()
      table.string("device_id").notNullable()
      table.integer('expiration_duration_ms').notNullable()
      table.dateTime('expired_at').notNullable()
      table.dateTime('verified_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}