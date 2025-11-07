import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'commands'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum("command_type",["SUBSCRIPTION","COMMAND"]).notNullable()
      table.integer("package_id").unsigned().references("id").inTable("packages")
      table.integer("user_id").unsigned().notNullable().references("id").inTable("users")
      table.integer("invoice_id").unsigned().references("id").inTable("invoices").notNullable()
      table.json('picking_days_times').notNullable()

      table.integer("command_kg").notNullable()
      table.integer("command_spent_kg").notNullable().defaultTo(0)
      table.string("command_description").notNullable()

      table.integer("merchant_kg_unit_cost").notNullable()
      table.integer("merchant_kg_total_cost").notNullable()
      table.integer("delivery_per_day_cost").notNullable()
      table.integer("delivery_cost").notNullable()
      table.integer("total_cost").notNullable()

      table.integer("order_min_price").notNullable()


      table.integer("price").notNullable()
      table.integer("margin").notNullable()
      table.enum("status", ["ACTIVE","CANCELED"])
      table.boolean("is_paid").defaultTo(false)

      table.integer("total_execution").defaultTo(0)

      table.decimal("multiple_picking_amount").defaultTo(0)

      table.dateTime("start_at").nullable()
      table.dateTime("end_at").nullable()
      table.dateTime("command_start_at").nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}