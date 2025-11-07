import Config from '#models/config'
import Merchant from '#models/merchant'
import Package from '#models/package'
import PaymentAccount from '#models/payment_account'
import ServiceAddon from '#models/service_addons'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // Configs - Use updateOrCreate to avoid duplicates
    await Config.updateOrCreate(
      { key: "SERVICE_MERCHANT_COST_PER_KG" },
      { key: "SERVICE_MERCHANT_COST_PER_KG", value: "300" },
    )
    await Config.updateOrCreate(
      { key: "SERVICE_DELIVERY_COST" },
      { key: "SERVICE_DELIVERY_COST", value: "500" }
    )
    await Config.updateOrCreate(
      { key: "PAYOUT_SERVICE_FEES_RATE" },
      { key: "PAYOUT_SERVICE_FEES_RATE", value: "0.1" }
    )

    // Fixed Packages - These are the only 4 packages in the system
    // Use updateOrCreate to avoid duplicates on re-seeding
    const packages = [
      {
        name: "Lessive unique",
        code: "LESSIVE_UNIQUE",
        kg: 1,
        amount: 600,
        isSubscriptable: false,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6
        }
      },
      // Total: 10000
      // Cout lessive : 6000
      // Cout livraison : 2000
      // Marge nette : 2000 
      {
        name: "Plan célibatire",
        code: "LESSIVE_CELIBATAIRE",
        kg: 5,
        amount: 2500,
        isSubscriptable: true,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6
        }
      },
      {
        name: "Plan couple",
        code: "LESSIVE_COUPLE",
        kg: 10,
        amount: 5500,
        isSubscriptable: true,

        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6,
          nombreDePersonnesMin: 2
        }
      },
      {
        name: "Plan famille",
        code: "LESSIVE_FAMILLE",
        kg: 30,
        amount: 14500,
        isSubscriptable: true,
        paidMultiplePickMin: 2,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6,
          nombreDePersonnesMin: 5,
          nombreDePersonnesMax: 6
        }
      }
    ]

    // Create packages using updateOrCreate to prevent duplicates
    for (const pkg of packages) {
      await Package.updateOrCreate(
        { code: pkg.code },
        {
          ...pkg,
          meta:JSON.stringify(pkg.meta)
        }
      )
    }


    // Service Addons - Use updateOrCreate to prevent duplicates
    const addons = [
      {
        key: "PICKING_MULTIPLE",
        code: "PICKING_MULTIPLE",
        name: "Collecte",
        price: 500,
        value: {
          merchantCost: 0
        }
      },
      {
        key: "SHIPPING",
        code: "SHIPPING_DEFAULT",
        name: "Standard",
        price: 0,
        value: {
          timeDurationApprox: 48,
          merchantCost: 0
        }
      },
      {
        key: "SHIPPING",
        code: "SHIPPING_FAST",
        name: "Standard",
        price: 100,
        value: {
          timeDurationApprox: 24,
          merchantCost: 50
        }
      },
      {

        key: "REPASSAGE",
        code: "REPASSAGE",
        name: "Repassage",
        price: 100,
        value: {
          merchantCost: 50
        }
      },
      // {
      //   key: "SHIPPING",
      //   code: "SHIPPING_PRIORITIZED",
      //   name: "Standard",
      //   price: '2000',
      //   value: {
      //     timeDurationApprox: "6"
      //   }
      // },
    ]

    // Create addons using updateOrCreate to prevent duplicates
    for (const addon of addons) {
      await ServiceAddon.updateOrCreate(
        { code: addon.code as any },
        addon as any
      )
    }

    const payoutFees = [
      {
        "type": "fixed",
        "from": 0,
        "to": 10000,
        "rate": 150
      },
      {
        "type": "fixed",
        "from": 10001,
        "to": 50000,
        "rate": 300
      },
      {
        "type": "fixed",
        "from": 50001,
        "to": 150000,
        "rate": 800
      },
      {
        "type": "fixed",
        "from": 150001,
        "to": 500000,
        "rate": 2000
      },
      {
        "type": "fixed",
        "from": 500001,
        "rate": 2500
      }
    ]
    const data = [
      {
        methodTitle:"Mtn Momo",
        methodClassName: "Fedapay",
        adressMethodType: "mtnmomo",
        providerMethodType: "mtn_open",
        country: "BJ",
        currency: "XOF",
        isDefault: true,
        payinFeeType: "UNIQUE",
        payinUniqueFees: 0.018,
        payoutFeeType: "VARIABLE",
        payoutVariableFees: JSON.stringify(payoutFees),
      },
      {
        methodTitle:"Moov Money",
        methodClassName: "Fedapay",
        adressMethodType: "moovmomo",
        providerMethodType: "mtn_open",
        country: "BJ",
        currency: "XOF",
        isDefault: true,
        payinFeeType: "UNIQUE",
        payinUniqueFees: 0.018,
        payoutFeeType: "VARIABLE",
        payoutVariableFees: JSON.stringify(payoutFees),
      },
      {
        methodTitle:"Celtis Cash",
        methodClassName: "Fedapay",
        adressMethodType: "celtiscash",
        providerMethodType: "mtn_open",
        country: "BJ",
        currency: "XOF",
        isDefault: true,
        payinFeeType: "UNIQUE",
        payinUniqueFees: 0.018,
        payoutFeeType: "VARIABLE",
        payoutVariableFees: JSON.stringify(payoutFees),
      }
    ]
    for (let d of data) {
      await PaymentAccount.updateOrCreate({
        methodClassName: d.methodClassName as any,
        adressMethodType: d.adressMethodType
      }, d as any)
    }
  }
}