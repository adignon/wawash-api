import User from '#models/user'
import Package from '#models/package'
import Merchant from '#models/merchant'
import Command from '#models/command'
import Order from '#models/order'
import Invoice from '#models/invoice'
import Adress from '#models/adress'
import PaymentAccount from '#models/payment_account'
import ServiceAddon from '#models/service_addons'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import { Decimal } from 'decimal.js'
import { createHash } from 'crypto'
import env from '#start/env'

export default class extends BaseSeeder {
  async run() {
    return;
    if(env.get("NODE_ENV")=="production"){
      return;
    }
        // Create merchants using updateOrCreate to prevent duplicates
    await Merchant.updateOrCreate(
      { name: 'Ets Cleaner' },
      {
        name: 'Ets Cleaner',
        phones: ["+2290191919191"],
      }
    )
    // Create test users if they don't exist
    const user1 = await User.firstOrCreate(
      { email: 'client1@test.com' },
      {
        email: 'client1@test.com',
        firstname: 'Marie',
        lastname: 'Kouadio',
        phone: '+22997111111',
        role: 'CLIENT',
        otpHash: await this.hashPassword('password123'),
        imageUrl: 'https://ui-avatars.com/api/?name=Marie+Kouadio&background=667eea&color=fff'
      }
    )

    const user2 = await User.firstOrCreate(
      { email: 'client2@test.com' },
      {
        email: 'client2@test.com',
        firstname: 'Jean',
        lastname: 'Akpaki',
        phone: '+22997222222',
        role: 'CLIENT',
        otpHash: await this.hashPassword('password123'),
        imageUrl: 'https://ui-avatars.com/api/?name=Jean+Akpaki&background=10b981&color=fff'
      }
    )

    const user3 = await User.firstOrCreate(
      { email: 'client3@test.com' },
      {
        email: 'client3@test.com',
        firstname: 'Aisha',
        lastname: 'Mensah',
        phone: '+22997333333',
        role: 'CLIENT',
        otpHash: await this.hashPassword('password123'),
        imageUrl: 'https://ui-avatars.com/api/?name=Aisha+Mensah&background=f59e0b&color=fff'
      }
    )

    // Create addresses for users
    await Adress.updateOrCreate(
      { userId: user1.id },
      {
        userId: user1.id,
        quartier: 'Akpakpa',
        commune: 'Cotonou',
        arrondissement: '1er arrondissement',
        departement: 'Littoral',
        country: 'Bénin',
        description: 'Près du marché Dantokpa',
        contactFullname: 'Marie Kouadio',
        contactPhone: '+22997111111'
      }
    )

    await Adress.updateOrCreate(
      { userId: user2.id },
      {
        userId: user2.id,
        quartier: 'Cadjèhoun',
        commune: 'Cotonou',
        arrondissement: '4ème arrondissement',
        departement: 'Littoral',
        country: 'Bénin',
        description: 'Face à la pharmacie',
        contactFullname: 'Jean Akpaki',
        contactPhone: '+22997222222'
      }
    )

    await Adress.updateOrCreate(
      { userId: user3.id },
      {
        userId: user3.id,
        quartier: 'Fidjrossè',
        commune: 'Cotonou',
        arrondissement: '13ème arrondissement',
        departement: 'Littoral',
        country: 'Bénin',
        description: 'Carrefour Fidjrossè plage',
        contactFullname: 'Aisha Mensah',
        contactPhone: '+22997333333'
      }
    )

    // Get packages
    const uniquePack = await Package.findByOrFail('code', 'LESSIVE_UNIQUE')
    const celibatairePack = await Package.findByOrFail('code', 'LESSIVE_CELIBATAIRE')
    const couplePack = await Package.findByOrFail('code', 'LESSIVE_COUPLE')
    const famillePack = await Package.findByOrFail('code', 'LESSIVE_FAMILLE')

    // Get service addons
    const shippingDefault = await ServiceAddon.findByOrFail('code', 'SHIPPING_DEFAULT')
    const shippingFast = await ServiceAddon.findByOrFail('code', 'SHIPPING_FAST')
    const repassage = await ServiceAddon.findByOrFail('code', 'REPASSAGE')

    // Get merchants
    const merchants = await Merchant.query().limit(3)
    if (merchants.length === 0) {
      console.log('No merchants found. Please seed merchants first.')
      return
    }

    // Create merchant addresses
    for (let i = 0; i < merchants.length; i++) {
      const merchant = merchants[i]
      await Adress.updateOrCreate(
        { merchantId: merchant.id, quartier: ['Akpakpa', 'Cadjèhoun', 'Fidjrossè'][i] },
        {
          merchantId: merchant.id,
          quartier: ['Akpakpa', 'Cadjèhoun', 'Fidjrossè'][i],
          commune: 'Cotonou',
          arrondissement: `${i + 1}er arrondissement`,
          departement: 'Littoral',
          country: 'Bénin',
          description: `Pressing ${merchant.name} - Quartier ${['Akpakpa', 'Cadjèhoun', 'Fidjrossè'][i]}`,
          contactFullname: merchant.name,
          contactPhone: (merchant.phones && merchant.phones[0]) || '+22900000000'
        }
      )
    }

    const paymentAccount = await PaymentAccount.query().where('isDefault', true).firstOrFail()

    console.log('Creating subscription commands and orders...')

    // ===== SUBSCRIPTION COMMAND WITH ORDERS =====
    // User1: Active subscription (Plan Célibataire)
    // Create invoice for subscription first
    const subInvoice1 = await Invoice.firstOrCreate(
      { userId: user1.id, invoiceType: 'SUBSCRIPTION_LAUNDRY' },
      {
        userId: user1.id,
        invoiceType: 'SUBSCRIPTION_LAUNDRY',
        amount: '10000',
        margin: 0,
        status: 'SUCCESS',
        paymentAccountId: paymentAccount.id
      }
    )

    const subCommand1 = await Command.firstOrCreate(
      { userId: user1.id, commandType: 'SUBSCRIPTION' },
      {
        userId: user1.id,
        commandType: 'SUBSCRIPTION',
        commandDescription: 'Plan célibataire avec livraison standard',
        packageId: celibatairePack.id,
        orderMinPrice: 2500,
        merchantKgTotalCost: 1500,
        merchantKgUnitCost: 300,
        deliveryPerDayCost: 500,
        deliveryCost: 2000, // 500 * 4 weeks
        totalExecution: 2,
        totalCost: 10000,
        margin: 2000,
        pickingDaysTimes: JSON.stringify([
          [1, ['08:00', '10:00']], // Lundi
          [4, ['14:00', '16:00']]  // Jeudi
        ]),
        commandStartAt: DateTime.now().minus({ weeks: 2 }),
        startAt: DateTime.now().minus({ weeks: 2 }),
        endAt: DateTime.now().plus({ weeks: 2 }),
        isPaid: true,
        status: 'ACTIVE',
        price: '10000',
        invoiceId: subInvoice1.id
      }
    )

    // Create subscription orders (week 1 - 2 orders)
    const subOrder1 = await this.createSubscriptionOrder({
      command: subCommand1,
      executionDate: DateTime.now().minus({ weeks: 1, days: 3 }),
      deliveryDate: DateTime.now().minus({ weeks: 1, days: 1 }),
      pickingHours: ['08:00', '10:00'],
      commandExecutionIndex: 1,
      orderExecutionIndex: 1,
      status: 'DELIVERED',
      userKg: 5.2, // Slight overweight
      merchantId: merchants[0].id
    })

    const subOrder2 = await this.createSubscriptionOrder({
      command: subCommand1,
      executionDate: DateTime.now().minus({ weeks: 1 }),
      deliveryDate: DateTime.now().minus({ days: 5 }),
      pickingHours: ['14:00', '16:00'],
      commandExecutionIndex: 1,
      orderExecutionIndex: 2,
      status: 'DELIVERED',
      userKg: 4.8,
      merchantId: merchants[0].id
    })

    // Create overweight invoice for subOrder1
    if (subOrder1.customerFeesToPay && subOrder1.customerFeesToPay > 0) {
      const overweightInvoice = await Invoice.create({
        userId: user1.id,
        margin: 0,
        invoiceType: 'SUBSCRIPTION_OVERWEIGHT',
        amount: subOrder1.customerFeesToPay.toString(),
        status: 'SUCCESS',
        paymentAccountId: paymentAccount.id
      })
      subOrder1.invoiceId = overweightInvoice.id
      await subOrder1.save()
    }

    // Week 2 orders (current week)
    await this.createSubscriptionOrder({
      command: subCommand1,
      executionDate: DateTime.now().startOf('week').plus({ days: 1 }),
      deliveryDate: DateTime.now().startOf('week').plus({ days: 3 }),
      pickingHours: ['08:00', '10:00'],
      commandExecutionIndex: 2,
      orderExecutionIndex: 1,
      status: 'WASHING',
      userKg: 5,
      merchantId: merchants[1]?.id || merchants[0].id
    })

    await this.createSubscriptionOrder({
      command: subCommand1,
      executionDate: DateTime.now().startOf('week').plus({ days: 4 }),
      deliveryDate: DateTime.now().startOf('week').plus({ days: 6 }),
      pickingHours: ['14:00', '16:00'],
      commandExecutionIndex: 2,
      orderExecutionIndex: 2,
      status: 'CREATED',
      userKg: null,
      merchantId: null
    })

    // User2: Subscription with famille pack
    const subInvoice2 = await Invoice.firstOrCreate(
      { userId: user2.id, invoiceType: 'SUBSCRIPTION_LAUNDRY' },
      {
        userId: user2.id,
        margin: 0,
        invoiceType: 'SUBSCRIPTION_LAUNDRY',
        amount: '28500',
        status: 'SUCCESS',
        paymentAccountId: paymentAccount.id
      }
    )

    const subCommand2 = await Command.firstOrCreate(
      { userId: user2.id, commandType: 'SUBSCRIPTION' },
      {
        userId: user2.id,
        commandType: 'SUBSCRIPTION',
        commandDescription: 'Plan famille avec repassage inclus',
        packageId: famillePack.id,
        orderMinPrice: 14500,
        merchantKgTotalCost: 9000,
        merchantKgUnitCost: 300,
        deliveryPerDayCost: 500,
        deliveryCost: 2000,
        totalExecution: 1,
        totalCost: 24000,
        margin: 4500,
        pickingDaysTimes: JSON.stringify([
          [2, ['09:00', '11:00']], // Mardi
          [5, ['15:00', '17:00']]  // Vendredi
        ]),
        commandStartAt: DateTime.now().minus({ days: 10 }),
        startAt: DateTime.now().minus({ days: 10 }),
        endAt: DateTime.now().plus({ days: 18 }),
        isPaid: true,
        status: 'ACTIVE',
        price: '28500',
        invoiceId: subInvoice2.id
      }
    )

    // Create orders for this subscription
    await this.createSubscriptionOrder({
      command: subCommand2,
      executionDate: DateTime.now().minus({ days: 8 }),
      deliveryDate: DateTime.now().minus({ days: 6 }),
      pickingHours: ['09:00', '11:00'],
      commandExecutionIndex: 1,
      orderExecutionIndex: 1,
      status: 'DELIVERED',
      userKg: 32, // Overweight
      merchantId: merchants[1]?.id || merchants[0].id
    })

    await this.createSubscriptionOrder({
      command: subCommand2,
      executionDate: DateTime.now().minus({ days: 5 }),
      deliveryDate: DateTime.now().minus({ days: 3 }),
      pickingHours: ['15:00', '17:00'],
      commandExecutionIndex: 1,
      orderExecutionIndex: 2,
      status: 'READY',
      userKg: 29,
      merchantId: merchants[1]?.id || merchants[0].id
    })

    console.log('Creating direct command orders (one-time orders)...')

    // ===== DIRECT COMMAND ORDERS (No commandId) =====
    // User3: Direct order 1 (unique laundry)
    console.log('Creating direct order 1...')
    await this.createDirectOrder({
      user: user3,
      package: uniquePack,
      executionDate: DateTime.now().plus({ days: 1 }),
      deliveryDate: DateTime.now().plus({ days: 3 }),
      pickingHours: ['10:00', '12:00'],
      status: 'CREATED',
      merchantId: null,
      shippingAddon: shippingDefault,
      hasRepassage: false
    })

    // User1: Direct order 2 (unique laundry with fast shipping)
    await this.createDirectOrder({
      user: user1,
      package: uniquePack,
      executionDate: DateTime.now().plus({ days: 2 }),
      deliveryDate: DateTime.now().plus({ days: 3 }),
      pickingHours: ['14:00', '16:00'],
      status: 'CREATED',
      merchantId: null,
      shippingAddon: shippingFast,
      hasRepassage: true
    })

    // User2: Direct order 3 (couple pack)
    await this.createDirectOrder({
      user: user2,
      package: couplePack,
      executionDate: DateTime.now().plus({ days: 3 }),
      deliveryDate: DateTime.now().plus({ days: 5 }),
      pickingHours: ['08:00', '10:00'],
      status: 'CREATED',
      merchantId: null,
      shippingAddon: shippingDefault,
      hasRepassage: false
    })

    // User3: Direct order 4 - Already picked up
    const directOrder4 = await this.createDirectOrder({
      user: user3,
      package: celibatairePack,
      executionDate: DateTime.now().minus({ days: 2 }),
      deliveryDate: DateTime.now(),
      pickingHours: ['09:00', '11:00'],
      status: 'PICKED',
      merchantId: merchants.length > 2 ? merchants[2].id : merchants[0].id,
      shippingAddon: shippingDefault,
      hasRepassage: false
    })

    // Evaluate the order (merchant sets actual kg)
    directOrder4.userKg = 5.5
    directOrder4.merchantTotalCost = new Decimal(300).mul(5.5).toNumber()
    directOrder4.customerOrderFinalPrice = new Decimal(500).mul(5.5).add(500).toNumber()
    directOrder4.customerFeesToPay = new Decimal(directOrder4.customerOrderFinalPrice).minus(directOrder4.customerOrderInitialPrice).toNumber()
    directOrder4.totalCost = new Decimal(500).add(directOrder4.merchantTotalCost!).toNumber()
    directOrder4.margin = new Decimal(directOrder4.customerOrderFinalPrice).minus(directOrder4.totalCost!).toNumber()
    await directOrder4.save()

    const commandCount = await Command.query().count('* as total')
    const orderCount = await Order.query().count('* as total')
    const subOrderCount = await Order.query().where('order_type', 'SUBSCRIPTION').count('* as total')
    const directOrderCount = await Order.query().where('order_type', 'COMMAND').count('* as total')

    console.log('✅ Orders and commands seeded successfully!')
    console.log(`   - Created ${commandCount[0].$extras.total} commands`)
    console.log(`   - Created ${orderCount[0].$extras.total} orders`)
    console.log(`   - Subscription orders: ${subOrderCount[0].$extras.total}`)
    console.log(`   - Direct orders: ${directOrderCount[0].$extras.total}`)
  }

  private async hashPassword(password: string): Promise<string> {
    const hash = await import('@adonisjs/core/services/hash')
    return hash.default.make(password)
  }

  private getOrderId(id: number): string {
    const salt = env.get('APP_KEY')
    const input = salt + id
    const hash = createHash('sha256').update(input).digest('hex')
    return hash.substring(0, 6).toUpperCase()
  }

  private async createSubscriptionOrder(data: {
    command: Command
    executionDate: DateTime
    deliveryDate: DateTime
    pickingHours: string[]
    commandExecutionIndex: number
    orderExecutionIndex: number
    status: string
    userKg: number | null
    merchantId: number | null
  }): Promise<Order> {
    const merchantCosts = {
      SHIPPING: {
        unitCost: 0,
        totalCost: 0
      }
    }

    // Access package through the relationship
    const pkg = await data.command.related('package').query().firstOrFail()

    const order = await Order.create({
      commandId: data.command.id,
      executionDuration: 48,
      executionDate: data.executionDate,
      pickingHours: JSON.stringify(data.pickingHours),
      deliveryDate: data.deliveryDate,
      deliveryType: 'SHIPPING_DEFAULT',
      capacityKg: Number(pkg.kg),
      orderTitle: data.command.commandDescription,
      commandExecutionIndex: data.commandExecutionIndex,
      orderExecutionIndex: data.orderExecutionIndex,
      status: data.status as any,
      orderType: 'SUBSCRIPTION',
      userId: data.command.userId,
      packageId: data.command.packageId,
      addons: JSON.stringify(merchantCosts) as any,
      deliveryCost: data.command.deliveryPerDayCost,
      merchantKgCost: data.command.merchantKgUnitCost,
      customerOrderKgPrice: new Decimal(pkg.amount).div(pkg.kg).toNumber(),
      customerOrderInitialPrice: Number(data.command.orderMinPrice),
      customerOrderFinalPrice: 0,
      merchantId: data.merchantId
    })

    order.orderId = this.getOrderId(order.id)

    // If userKg is set, calculate costs
    if (data.userKg) {
      order.userKg = data.userKg
      order.merchantTotalCost = new Decimal(order.merchantKgCost!).mul(data.userKg).toNumber()
      order.customerOrderFinalPrice = new Decimal(order.customerOrderKgPrice!).mul(data.userKg).toNumber()
      order.customerFeesToPay = new Decimal(order.customerOrderFinalPrice).minus(order.customerOrderInitialPrice).toNumber()
      order.totalCost = new Decimal(order.deliveryCost).add(order.merchantTotalCost).toNumber()
      order.margin = new Decimal(order.customerOrderFinalPrice).minus(order.totalCost).toNumber()

      // Set payment status for delivered orders
      if (data.status === 'DELIVERED') {
        order.merchantPaymentStatus = 'REVERSED'
      } else if (data.status === 'WASHING' || data.status === 'READY') {
        order.merchantPaymentStatus = 'PENDING'
      }
    }

    await order.save()
    return order
  }

  private async createDirectOrder(data: {
    user: User
    package: Package
    executionDate: DateTime
    deliveryDate: DateTime
    pickingHours: string[]
    status: string
    merchantId: number | null
    shippingAddon: ServiceAddon
    hasRepassage: boolean
  }): Promise<Order> {
    // Ensure addon value is properly accessed
    const shippingValue = data.shippingAddon.value as any
    const merchantCosts: any = {
      SHIPPING: {
        unitCost: shippingValue?.merchantCost || 0,
        totalCost: 0
      }
    }

    let addonMerchantCost = shippingValue?.merchantCost || 0
    let addonsKgCost = Number(data.shippingAddon.price || 0)

    if (data.hasRepassage) {
      const repassage = await ServiceAddon.findByOrFail('code', 'REPASSAGE')
      const repassageValue = repassage.value as any
      merchantCosts['REPASSAGE'] = {
        unitCost: repassageValue?.merchantCost || 0,
        totalCost: 0
      }
      addonMerchantCost += Number(repassageValue?.merchantCost || 0)
      addonsKgCost += Number(repassage.price || 0)
    }

    if (!data.user || !data.package) {
      console.error('❌ Error: Missing user or package data')
      console.error('User:', data.user)
      console.error('Package:', data.package)
      throw new Error('User and Package are required for creating direct order')
    }

    const customerOrderKgPrice = new Decimal(data.package.amount).add(addonsKgCost).div(data.package.kg).toNumber()
    const customerOrderInitialPrice = 0 // Direct orders don't have initial price

    console.log('Creating order for user:', data.user.id, 'package:', data.package.id)

    const order = await Order.create({
      commandId: null as any,
      executionDuration: Number(shippingValue?.timeDurationApprox || 48),
      executionDate: data.executionDate,
      pickingHours: JSON.stringify(data.pickingHours),
      deliveryDate: data.deliveryDate,
      deliveryType: data.shippingAddon.code as any,
      capacityKg: 0,
      orderTitle: data.package.name + (data.hasRepassage ? ' avec repassage' : ''),
      commandExecutionIndex: 1,
      orderExecutionIndex: 1,
      status: data.status as any,
      orderType: 'COMMAND',
      userId: data.user.id,
      packageId: data.package.id,
      addons: JSON.stringify(merchantCosts) as any,
      deliveryCost: 500,
      merchantKgCost: new Decimal(300).add(addonMerchantCost).toNumber(),
      customerOrderKgPrice,
      customerOrderInitialPrice,
      customerOrderFinalPrice: 0,
      merchantId: data.merchantId
    })

    order.orderId = this.getOrderId(order.id)

    // Set payment status for picked orders
    if (data.status === 'PICKED' || data.status === 'WASHING') {
      order.merchantPaymentStatus = 'PENDING'
    }

    await order.save()
    return order
  }
}
