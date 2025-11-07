import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'adresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string("quartier").notNullable()
      table.string("commune").notNullable()
      table.string("arrondissement").notNullable()
      table.string("departement").notNullable()
      table.text("description").nullable()
      table.string("country").notNullable()
      table.string("contact_fullname").notNullable()
      table.string("contact_phone").notNullable()
      table.point("coordinates").nullable()
      table.integer("user_id").unsigned().nullable().references("id").inTable("users")
      table.integer("merchant_id").unsigned().nullable().references("id").inTable("merchants")

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}