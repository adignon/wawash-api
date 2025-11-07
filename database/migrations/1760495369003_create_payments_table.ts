import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.decimal("ask_amount",18,2).notNullable()
      table.decimal("sent_amount",18,2).notNullable()
      table.decimal("network_fees",18,2).notNullable()
      table.decimal("service_fees",18,2).notNullable()
      table.string("receving_adress").notNullable()
      table.string("payment_hash").nullable()
      table.dateTime("paid_at").nullable()
      table.integer("payment_account_id").unsigned().references("id").inTable("payment_accounts").notNullable()
      table.integer("user_id").unsigned().references("id").inTable("users").notNullable()
      table.integer("merchant_id").unsigned().references("id").inTable("merchants").notNullable()
      table.enum("status",["PENDING","SUCCESS","FAILED", "CREATED"]).notNullable()
      table.text("comment").nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}