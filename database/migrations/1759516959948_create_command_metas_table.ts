import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'command_metas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer("command_id").unsigned().references("id").inTable("commands").onDelete("CASCADE").notNullable()
      table.integer("addon_id").unsigned().references("id").inTable("service_addons").notNullable()
      table.string("value").nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}