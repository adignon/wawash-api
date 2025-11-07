import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("method_title").notNullable()
      table.string("country").notNullable()
      table.boolean("is_default").notNullable()
      table.string("adress_method_type").notNullable()
      table.string("provider_method_type").notNullable()
      table.string("method_class_name").notNullable()
      table.string("currency").notNullable()
      table.decimal("balance", 18, 2).defaultTo(0)
      table.decimal("frozen_balance",  18, 2).defaultTo(0)
      table.enum("payin_fee_type",["VARIABLE","UNIQUE"]).notNullable()
      table.decimal("payin_unique_fees").defaultTo(0).comment("Si la valeur définie est >= 1 alors c'est un taux fixe, si < 1 alors c'est un taux en % ")
      table.json("payin_variable_fees")
      table.enum("payout_fee_type",["VARIABLE","UNIQUE"]).notNullable()
      table.decimal("payout_unique_fees").defaultTo(0).comment("Si la valeur définie est >= 1 alors c'est un taux fixe, si < 1 alors c'est un taux en % ")
      table.json("payout_variable_fees")
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}