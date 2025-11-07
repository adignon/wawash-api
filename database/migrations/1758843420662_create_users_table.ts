import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable().primary()
      table.string('lastname').notNullable()
      table.string('firstname').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('phone', 20).notNullable().unique()
      table.string('otp_hash').nullable()
      table.string('image_url').notNullable()
      table.string('role').notNullable().checkIn(["CLIENT","CLEANER","ADMIN"])
      table.string('last_device').nullable()
      table.integer('merchant_id').unsigned().references("id").inTable("merchants").nullable()
      table.boolean('two_factor_enabled').defaultTo(false)
      table.string('two_factor_secret').nullable()
      table.text('two_factor_recovery_codes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}