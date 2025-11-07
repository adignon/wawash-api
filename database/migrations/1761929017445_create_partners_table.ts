import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'partners'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('full_name').notNullable()
      table.string('phone').notNullable()
      table.enum('service_type', ['launderer', 'pressing', 'delivery', 'other']).notNullable()
      table.string('location').notNullable()
      table.text('experience').nullable()
      table.text('motivation').notNullable()
      table.enum('status', ['pending', 'approved', 'rejected', 'contacted']).defaultTo('pending')
      table.text('admin_notes').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}