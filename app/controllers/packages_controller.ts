import Package from '#models/package'
import ServiceAddon from '#models/service_addons';
import SubscriptionsController from '#controllers/subscriptions_controller';
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core';

@inject()
export default class PackagesController {
    
    constructor(private subscription:SubscriptionsController){

    }
    async getPackages({ request, auth }: HttpContext) {
        const packages = !request.param("type") ? await Package.all() : await Package.query().where("code", request.param("type")).first();
        return {
            packages,
            subscription:await this.subscription.getUserActiveSubscription(auth.user!.id)
        }
    }

    async getServicesAddons({ }: HttpContext) {
        const data: any = {}
        const shipings = await ServiceAddon.query().whereIn("key", ["SHIPPING", "REPASSAGE","PICKING_MULTIPLE"])
        data.shippings = {}
        shipings.forEach((s) => {
            if (s.key == "REPASSAGE") {
                data.drying = s
            } else if (s.key == "SHIPPING") {
                data.shippings[s.code.toLowerCase()] = s
            } else if (s.key == "PICKING_MULTIPLE") {
                data.pickingMultiple = s
            }
        })
        return data;
    }
}