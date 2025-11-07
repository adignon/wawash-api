import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Composite unique index to prevent duplicate assignments
      table.unique(['user_id', 'permission_id'])
      table.index('user_id')
      table.index('permission_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}