import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 100).notNullable().unique() // e.g., 'users.read', 'users.create'
      table.string('module', 50).notNullable() // e.g., 'users', 'merchants', 'orders'
      table.string('action', 50).notNullable() // e.g., 'read', 'create', 'update', 'delete'
      table.string('description', 255).nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Index for faster lookups
      table.index(['module', 'action'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}