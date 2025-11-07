import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'packages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string("name").notNullable()
      table.string("code").notNullable().unique().checkIn(["LESSIVE_FAMILLE","LESSIVE_COUPLE","LESSIVE_CELIBATAIRE","LESSIVE_UNIQUE"])
      table.decimal("kg").notNullable()
      table.integer("amount").notNullable()
      table.integer("paid_multiple_pick_min").defaultTo(1)
      table.boolean("is_subscriptable").notNullable()
      table.jsonb("meta").notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}