import OrdersController from '#controllers/orders_controller'
import Command from '#models/command'
import { inject } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class Worker extends BaseCommand {
  static commandName = 'worker:start'
  static description = 'Lancer les worker'

  static options: CommandOptions = {
    startApp: false
  }

  @inject()
  async prepare(command:Command) {
   
  }
  @inject()
  async run() {
    const orderController=new OrdersController()
    console.log( orderController.getPickupsDates(new Date(2020, 10, 10, 12,0,0), [[1,['17:00','19:00']]]))
  }
}