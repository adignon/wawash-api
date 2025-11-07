import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum("invoice_type",["SUBSCRIPTION_LAUNDRY", "COMMAND_LAUNDRY","SUBSCRIPTION_OVERWEIGHT"]).notNullable()
      table.decimal("amount", 18,2).notNullable()
      table.decimal("margin", 18,2).notNullable()
      table.string("payment_hash").nullable()
      table.string("meta").nullable()
      table.dateTime("paid_at").nullable()
      table.integer("payment_account_id").unsigned().references("id").inTable("payment_accounts").notNullable()
      table.enum("status",["CREATED","PENDING","SUCCESS","FAILED"]).notNullable()
      table.integer("user_id").unsigned().references("id").inTable("users")
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}