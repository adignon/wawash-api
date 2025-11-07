import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'merchants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("name").notNullable()
      table.string("phones", 255).notNullable()
      table.decimal("balance").defaultTo(0)
      table.decimal("frozen_balance").defaultTo(0)
      table.enum("washing_type",["MANUAL","MACHINE"]).defaultTo("MANUAL")
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}