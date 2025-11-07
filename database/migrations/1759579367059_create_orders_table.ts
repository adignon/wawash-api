import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string("order_id").unique()
      table.string("order_title")
      table.integer("command_id").unsigned().nullable().references("id").inTable("commands")
      table.integer("user_id").unsigned().notNullable().references("id").inTable("users")
      table.integer('merchant_id').nullable().unsigned().references("id").inTable("merchants")
      table.enum("delivery_type", ["SHIPPING_DEFAULT", "SHIPPING_FAST", "SHIPPING_PRIORITIZED"])
      table.integer("capacity_kg").notNullable()
      table.integer("user_kg").nullable()
      table.integer("package_id").unsigned().references("id").inTable("packages").notNullable()

      table.integer("invoice_id").unsigned().references("id").inTable("invoices").nullable()

      table.integer("customer_order_kg_price").notNullable()
      table.integer("customer_order_initial_price").notNullable()
      table.integer("customer_order_final_price").nullable()
      table.integer("customer_fees_to_pay").nullable()

      table.enum("status", ["CREATED", "STARTED", "PICKED", "WASHING", "DELIVERED", "CANCELED", "READY","NOTEXECUTED"]).notNullable()
      table.enum("merchant_payment_status", ["PENDING", "REVERSED"]).nullable()
      table.enum("order_type", ["SUBSCRIPTION", "COMMAND"]).notNullable()
      

      table.decimal("delivery_cost", 18,2).notNullable()
      table.decimal("merchant_kg_cost", 18,2).notNullable()
      table.decimal("merchant_total_cost", 18,2).nullable()

      table.decimal("total_cost", 18,2).nullable()
      table.decimal("margin", 18,2).defaultTo(0)


      table.integer("order_execution_index")
      table.integer("command_execution_index")

      table.dateTime("execution_date")
      
      table.integer("execution_duration")
      table.json("picking_hours")
      table.dateTime("delivery_date").notNullable()

      table.json("addons")


      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}