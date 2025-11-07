import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_addons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("key").notNullable()
      table.string('name').notNullable()
      table.string("code").notNullable().unique()
      table.integer("price").notNullable()
      table.jsonb("value").nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}