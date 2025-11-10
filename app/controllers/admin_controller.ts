import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class AdminController {
  // Show login page
  async showLogin({ view, auth, response }: HttpContext) {
    await auth.use('web').check()
    if (auth.use('web').isAuthenticated) {
      const user = auth.use('web').user
      if (user && user.role === 'ADMIN') {
        return response.redirect().toRoute('admin.dashboard')
      }
    }

    return view.render('admin/login')
  }

  // Handle login
  async login({ request, auth, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        email: vine.string().email(),
        password: vine.string().minLength(6),
      })
    )
    try {
      const data = await request.validateUsing(validator)

      // Find admin user
      const user = await User.query()
        .where('email', data.email)
        .where('role', 'ADMIN')
        .first()

      if (!user) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      // Verify password
      if (!user.otpHash) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      const isValidPassword = await hash.verify(user.otpHash, data.password)

      if (!isValidPassword) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled) {
        // Store user ID in session temporarily to require 2FA setup
        session.put('pending_2fa_setup_user_id', user.id)
        session.flash('info', 'You must set up two-factor authentication before continuing')
        return response.redirect().toRoute('admin.2fa.setup')
      }

      // Store user ID in session temporarily for 2FA verification
      session.put('pending_2fa_user_id', user.id)
      return response.redirect().toRoute('admin.2fa.verify')
    } catch (error) {
      logger.error("Failed to authenticate admin user during login", error)
      session.flash('error', 'Invalid credentials')
      return response.redirect().toRoute('admin.login')
    }
  }

  // Logout
  async logout({ auth, response, session }: HttpContext) {
    // Clear any pending 2FA sessions
    session.forget('pending_2fa_setup_user_id')
    session.forget('pending_2fa_user_id')

    // Logout user if authenticated
    await auth.use('web').logout()

    session.flash('success', 'Logged out successfully')
    return response.redirect().toRoute('admin.login')
  }

  // Show 2FA setup page
  async show2FASetup({ view, session, response }: HttpContext) {
    const userId = session.get('pending_2fa_setup_user_id')

    if (!userId) {
      return response.redirect().toRoute('admin.login')
    }

    const user = await User.find(userId)

    if (!user) {
      session.forget('pending_2fa_setup_user_id')
      return response.redirect().toRoute('admin.login')
    }

    // Generate 2FA secret if not exists
    const speakeasy = await import('speakeasy')
    const qrcode = await import('qrcode')

    if (!user.twoFactorSecret) {
      const secret = speakeasy.default.generateSecret({
        name: `GoWash Admin (${user.email})`,
        issuer: 'GoWash'
      })

      user.twoFactorSecret = secret.base32
      await user.save()
    }

    const otpauthUrl = speakeasy.default.otpauthURL({
      secret: user.twoFactorSecret!,
      label: user.email!,
      issuer: 'GoWash',
      encoding: 'base32'
    })

    const qrCodeDataUrl = await qrcode.default.toDataURL(otpauthUrl)

    return view.render('admin/2fa-setup', {
      user,
      qrCodeDataUrl,
      secret: user.twoFactorSecret
    })
  }

  // Handle 2FA setup completion
  async complete2FASetup({ request, session, response }: HttpContext) {
    const userId = session.get('pending_2fa_setup_user_id')

    if (!userId) {
      return response.redirect().toRoute('admin.login')
    }

    const user = await User.find(userId)

    if (!user || !user.twoFactorSecret) {
      session.forget('pending_2fa_setup_user_id')
      return response.redirect().toRoute('admin.login')
    }

    const validator = vine.compile(
      vine.object({
        otp: vine.string().regex(/^[0-9]{6}$/),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      const speakeasy = await import('speakeasy')

      const verified = speakeasy.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: data.otp,
        window: 2
      })

      if (!verified) {
        session.flash('error', 'Invalid verification code. Please try again.')
        return response.redirect().back()
      }

      // Enable 2FA for user
      user.twoFactorEnabled = true
      await user.save()

      // Clear setup session and set verification session
      session.forget('pending_2fa_setup_user_id')
      session.put('pending_2fa_user_id', user.id)

      session.flash('success', 'Two-factor authentication has been enabled successfully!')
      return response.redirect().toRoute('admin.2fa.verify')
    } catch (error) {
      logger.error("Failed to complete 2FA setup: Invalid OTP code provided", error)
      session.flash('error', 'Invalid verification code format')
      return response.redirect().back()
    }
  }

  // Show 2FA verification page (during login)
  async show2FAVerify({ view, session, response }: HttpContext) {
    const userId = session.get('pending_2fa_user_id')

    if (!userId) {
      return response.redirect().toRoute('admin.login')
    }

    const user = await User.find(userId)

    if (!user || !user.twoFactorEnabled) {
      session.forget('pending_2fa_user_id')
      return response.redirect().toRoute('admin.login')
    }

    return view.render('admin/2fa-verify', { user })
  }

  // Handle 2FA verification (during login)
  async verifyLogin2FA({ request, auth, session, response }: HttpContext) {
    const userId = session.get('pending_2fa_user_id')

    if (!userId) {
      return response.redirect().toRoute('admin.login')
    }

    const user = await User.find(userId)

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      session.forget('pending_2fa_user_id')
      return response.redirect().toRoute('admin.login')
    }

    const validator = vine.compile(
      vine.object({
        otp: vine.string().regex(/^[0-9]{6}$/),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      const speakeasy = await import('speakeasy')

      const verified = speakeasy.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: data.otp,
        window: 2
      })

      if (!verified) {
        session.flash('error', 'Invalid verification code. Please try again.')
        return response.redirect().back()
      }

      // Login user
      await auth.use('web').login(user)
      session.forget('pending_2fa_user_id')

      session.flash('success', 'Welcome back!')
      return response.redirect().toRoute('admin.dashboard')
    } catch (error) {
      logger.error("Failed to verify 2FA code during login", error)
      session.flash('error', 'Invalid verification code format')
      return response.redirect().back()
    }
  }

  // Dashboard
  async dashboard({ view }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Command = (await import('#models/command')).default
    const Merchant = (await import('#models/merchant')).default
    const Payment = (await import('#models/payment')).default

    try {
      // Get total counts
      const totalOrders = await Order.query().count('* as total')
      const totalUsers = await User.query().where('role', 'USER').count('* as total')
      const totalMerchants = await Merchant.query().count('* as total')
      const activeMerchants = await Merchant.query().count('* as total')

      // Get order statistics
      const pendingOrders = await Order.query().where('status', 'CREATED').count('* as total')
      const processingOrders = await Order.query().whereIn('status', ['WASHING', 'PICKED']).count('* as total')
      const completedOrders = await Order.query().where('status', 'DELIVERED').count('* as total')

      // Get active subscriptions
      const activeSubscriptions = await Command.query()
        .where('commandType', 'SUBSCRIPTION')
        .count('* as total')

      // Calculate total revenue (sum of successful payments)
      const revenueResult = await Payment.query()
        .whereIn('status', ['SUCCESS', 'COMPLETED'])
        .sum('ask_amount as total')

      const totalRevenue = revenueResult[0]?.$extras?.total || 0

      // Get recent orders
      const recentOrders = await Order.query()
        .preload('user')
        .preload('package')
        .orderBy('createdAt', 'desc')
        .limit(5)

      // Get recent payments
      const recentPayments = await Payment.query()
        .preload('user')
        .orderBy('createdAt', 'desc')
        .limit(5)

      return view.render('admin/dashboard', {
        stats: {
          totalOrders: totalOrders[0].$extras.total,
          totalUsers: totalUsers[0].$extras.total,
          totalMerchants: totalMerchants[0].$extras.total,
          activeMerchants: activeMerchants[0].$extras.total,
          totalRevenue: parseFloat(String(totalRevenue)),
          pendingOrders: pendingOrders[0].$extras.total,
          processingOrders: processingOrders[0].$extras.total,
          completedOrders: completedOrders[0].$extras.total,
          activeSubscriptions: activeSubscriptions[0].$extras.total,
        },
        recentOrders,
        recentPayments,
      })
    } catch (error) {
      console.log(error)
      logger.error("Failed to load dashboard statistics", error)
      return view.render('admin/dashboard', {
        stats: {
          totalOrders: 0,
          totalUsers: 0,
          totalMerchants: 0,
          activeMerchants: 0,
          totalRevenue: 0,
          pendingOrders: 0,
          processingOrders: 0,
          completedOrders: 0,
          activeSubscriptions: 0,
        },
        recentOrders: [],
        recentPayments: [],
      })
    }
  }

  // No Permissions page
  async noPermissions({ view, auth }: HttpContext) {
    const user = auth.use('web').user
    return view.render('admin/no-permissions', { user })
  }

  // List all admins
  async index({ view }: HttpContext) {
    const admins = await User.query().where('role', 'ADMIN').orderBy('created_at', 'desc')

    return view.render('admin/admins/index', { admins })
  }

  // Show create admin form
  async create({ view }: HttpContext) {
    return view.render('admin/admins/create')
  }

  // Store new admin
  async store({ request, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(3),
        lastname: vine.string().minLength(3),
        email: vine.string().email().unique(async (db, value) => {
          const user = await db.from('users').where('email', value).first()
          return !user
        }),
        phone: vine
          .string()
          .regex(/^\+22901[0-9]{8}$/)
          .unique(async (db, value) => {
            const user = await db.from('users').where('phone', value).first()
            return !user
          }),
        password: vine.string().minLength(8),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Hash password
      const hashedPassword = await hash.make(data.password)

      // Create admin user
      await User.create({
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        phone: data.phone,
        otpHash: hashedPassword, // Temporarily using otpHash for password
        role: 'ADMIN',
        imageUrl: `https://ui-avatars.com/api/?name=${data.firstname}+${data.lastname}&background=random`,
      })

      session.flash('success', 'Admin created successfully')
      return response.redirect().toRoute('admin.admins.index')
    } catch (error) {
      logger.error("Failed to create new admin user", error)
      session.flash('error', 'Failed to create admin. Please check your inputs.')
      return response.redirect().back()
    }
  }

  // Show edit admin form
  async edit({ params, view, response, session }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    return view.render('admin/admins/edit', { admin })
  }

  // Update admin
  async update({ params, request, response, session }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(3),
        lastname: vine.string().minLength(3),
        email: vine.string().email(),
        phone: vine.string().regex(/^\+22901[0-9]{8}$/),
        password: vine.string().minLength(8).optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      admin.firstname = data.firstname
      admin.lastname = data.lastname
      admin.email = data.email
      admin.phone = data.phone

      if (data.password) {
        admin.otpHash = await hash.make(data.password)
      }

      await admin.save()

      session.flash('success', 'Admin updated successfully')
      return response.redirect().toRoute('admin.admins.index')
    } catch (error) {
      logger.error("Failed to update admin user information", error)
      session.flash('error', 'Failed to update admin')
      return response.redirect().back()
    }
  }

  // Delete admin
  async delete({ params, response, session, auth }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    // Prevent deleting self
    if (admin.id === auth.use('web').user?.id) {
      session.flash('error', 'You cannot delete your own account')
      return response.redirect().toRoute('admin.admins.index')
    }

    await admin.delete()

    session.flash('success', 'Admin deleted successfully')
    return response.redirect().toRoute('admin.admins.index')
  }

  // Packages Management
  async packagesIndex({ view }: HttpContext) {
    const Package = (await import('#models/package')).default
    const packages = await Package.query().orderBy('id', 'asc')
    return view.render('admin/packages/index', { packages })
  }

  async packagesEdit({ params, view, response, session }: HttpContext) {
    const Package = (await import('#models/package')).default
    const pkg = await Package.find(params.id)

    if (!pkg) {
      session.flash('error', 'Package not found')
      return response.redirect().toRoute('admin.packages.index')
    }

    return view.render('admin/packages/edit', { package: pkg })
  }

  async packagesUpdate({ params, request, response, session }: HttpContext) {
    const Package = (await import('#models/package')).default
    const pkg = await Package.find(params.id)

    if (!pkg) {
      session.flash('error', 'Package not found')
      return response.redirect().toRoute('admin.packages.index')
    }

    const validator = vine.compile(
      vine.object({
        amount: vine.number().min(0),
        kg: vine.number().min(0),
        paidMultiplePickMin: vine.number().min(0).optional(),
        nombreDeJoursDeVetementMin: vine.number().min(0),
        nombreDeJoursDeVetementMax: vine.number().min(0),
        nombreDePersonnesMin: vine.number().min(0).optional(),
        nombreDePersonnesMax: vine.number().min(0).optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      pkg.amount = data.amount
      pkg.kg = data.kg
      if (data.paidMultiplePickMin !== undefined) {
        pkg.paidMultiplePickMin = data.paidMultiplePickMin
      }

      // Update meta fields
      const meta: any = {
        nombreDeJoursDeVetementMin: data.nombreDeJoursDeVetementMin,
        nombreDeJoursDeVetementMax: data.nombreDeJoursDeVetementMax,
      }

      // Add optional fields if provided
      if (data.nombreDePersonnesMin !== undefined && data.nombreDePersonnesMin > 0) {
        meta.nombreDePersonnesMin = data.nombreDePersonnesMin
      }
      if (data.nombreDePersonnesMax !== undefined && data.nombreDePersonnesMax > 0) {
        meta.nombreDePersonnesMax = data.nombreDePersonnesMax
      }

      pkg.meta = JSON.stringify(meta)
      await pkg.save()

      session.flash('success', 'Package updated successfully')
      return response.redirect().toRoute('admin.packages.index')
    } catch (error) {
      logger.error("Failed to update package pricing and metadata", error)
      session.flash('error', 'Failed to update package')
      return response.redirect().back()
    }
  }

  // Configuration Management
  async configIndex({ view }: HttpContext) {
    const Config = (await import('#models/config')).default
    const configs = await Config.query().orderBy('key', 'asc')
    return view.render('admin/config/index', { configs })
  }

  async configUpdate({ params, request, response, session }: HttpContext) {
    const Config = (await import('#models/config')).default
    const config = await Config.find(params.id)

    if (!config) {
      session.flash('error', 'Configuration not found')
      return response.redirect().toRoute('admin.config.index')
    }

    const validator = vine.compile(
      vine.object({
        value: vine.string(),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      config.value = data.value
      await config.save()

      session.flash('success', 'Configuration updated successfully')
      return response.redirect().toRoute('admin.config.index')
    } catch (error) {
      logger.error("Failed to update system configuration value", error)
      session.flash('error', 'Failed to update configuration')
      return response.redirect().back()
    }
  }

  // User Settings (2FA)
  async settingsIndex({ view, auth, response, session }: HttpContext) {
    // Check if user is authenticated
    const authUser = auth.use('web').user
    if (!authUser) {
      session.flash('error', 'Please login to access settings')
      return response.redirect().toRoute('auth.login')
    }

    const User = (await import('#models/user')).default

    // Reload user from database to ensure we have all fields including 2FA fields
    const user = await User.find(authUser.id)

    if (!user) {
      session.flash('error', 'User not found')
      return response.redirect().toRoute('admin.dashboard')
    }

    // Ensure twoFactorEnabled has a default value
    const twoFactorEnabled = user.twoFactorEnabled === true

    return view.render('admin/settings/index', {
      user,
      twoFactorEnabled
    })
  }

  async enable2FA({ auth, response }: HttpContext) {
    const speakeasy = await import('speakeasy')
    const QRCode = await import('qrcode')
    const user = auth.use('web').user!

    // Generate secret
    const secret = speakeasy.default.generateSecret({
      name: `GoWash (${user.email || user.phone})`,
      issuer: 'GoWash'
    })

    // Store secret temporarily (not enabled yet)
    user.twoFactorSecret = secret.base32
    await user.save()

    // Generate QR code
    const qrCodeUrl = await QRCode.default.toDataURL(secret.otpauth_url!)

    return response.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    })
  }

  async verify2FA({ auth, request, response, session }: HttpContext) {
    const speakeasy = await import('speakeasy')
    const user = auth.use('web').user!
    const token = request.input('token')

    if (!user.twoFactorSecret) {
      return response.badRequest({ error: '2FA not initialized' })
    }

    // Verify the token
    const verified = speakeasy.default.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    })

    if (verified) {
      // Generate recovery codes
      const recoveryCodes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 10).toUpperCase()
      )

      user.twoFactorEnabled = true
      user.twoFactorRecoveryCodes = JSON.stringify(recoveryCodes)
      await user.save()

      session.flash('success', '2FA enabled successfully')
      return response.json({
        success: true,
        recoveryCodes
      })
    } else {
      return response.badRequest({ error: 'Invalid token' })
    }
  }

  async disable2FA({ auth, request, response, session }: HttpContext) {
    const user = auth.use('web').user!
    const password = request.input('password')

    // Here you would verify the password
    // For now, we'll just disable it
    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    user.twoFactorRecoveryCodes = null
    await user.save()

    session.flash('success', '2FA disabled successfully')
    return response.redirect().toRoute('admin.settings.index')
  }

  // Subscriptions & Orders
  async subscriptions({ view, request }: HttpContext) {
    const Command = (await import('#models/command')).default
    const Order = (await import('#models/order')).default
    const Merchant = (await import('#models/merchant')).default

    // Get search query
    const search = request.input('search', '').trim()

    // Fetch active subscriptions
    let subscriptionsQuery = Command.query()
      .where('commandType', 'SUBSCRIPTION')
      .where('status', 'ACTIVE')
      .preload('user')
      .preload('package')
      .orderBy('createdAt', 'desc')

    // Apply search filter if provided
    if (search) {
      subscriptionsQuery = subscriptionsQuery.whereHas('user', (userQuery) => {
        userQuery
          .whereILike('firstname', `%${search}%`)
          .orWhereILike('lastname', `%${search}%`)
          .orWhereILike('phone', `%${search}%`)
      })
    }

    const subscriptions = await subscriptionsQuery

    // Fetch planned orders for each subscription
    const now = new Date()
    const subscriptionsWithOrders = await Promise.all(
      subscriptions.map(async (subscription) => {
        const orders = await Order.query()
          .where('commandId', subscription.id)
          .where('orderType', 'SUBSCRIPTION')
          .whereIn('status', ['CREATED', 'STARTED', 'PICKED', 'WASHING', 'READY', 'DELIVERED'])
          .orderBy('executionDate', 'asc')

        // Manually load merchant for orders that have merchantId and parse hours
        const ordersWithMerchant = await Promise.all(
          orders.map(async (order) => {
            const orderJson = order.toJSON()
            if (order.merchantId) {
              const merchant = await Merchant.find(order.merchantId)
              orderJson.merchant = merchant ? merchant.toJSON() : null
            } else {
              orderJson.merchant = null
            }
 
            if (orderJson.pickingHours) {
              try {
                const pickingHoursArray = orderJson.pickingHours
                if (Array.isArray(pickingHoursArray) && pickingHoursArray.length === 2) {
                  orderJson.pickingHoursFormatted = `${pickingHoursArray[0]} - ${pickingHoursArray[1]}`
                } else {
                  orderJson.pickingHoursFormatted = 'N/A'
                }
              } catch (e) {
                logger.error("Failed to parse picking hours for subscription order", e)
                orderJson.pickingHoursFormatted = 'N/A'
              }
            } else {
              orderJson.pickingHoursFormatted = 'N/A'
            }

            return orderJson
          })
        )

        // Calculate subscription status
        const subJson = subscription.toJSON()
        let subscriptionStatus = 'PENDING'
        if (subJson.endAt) {
          const endDate = new Date(subJson.endAt)
          if (endDate >= now) {
            subscriptionStatus = 'ACTIVE'
          } else {
            subscriptionStatus = 'EXPIRED'
          }
        }

        return {
          ...subJson,
          orders: ordersWithMerchant,
          subscriptionStatus: subscriptionStatus
        }
      })
    )

    // Calculate statistics
    let activeCount = 0
    let expiredCount = 0
    let totalOrders = 0

    subscriptionsWithOrders.forEach((sub: any) => {
      totalOrders += sub.orders.length
      if (sub.endAt) {
        const endDate = new Date(sub.endAt)
        if (endDate >= now) {
          activeCount++
        } else {
          expiredCount++
        }
      }
    })

    return view.render('admin/subscriptions/index', {
      subscriptions: subscriptionsWithOrders,
      stats: {
        total: subscriptionsWithOrders.length,
        active: activeCount,
        expired: expiredCount,
        totalOrders: totalOrders
      },
      search: search
    })
  }

  async orders({ view }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Merchant = (await import('#models/merchant')).default

    const orders = await Order.query()
      .preload('user')
      .preload('package')
      .orderBy('executionDate', 'asc')

    // Manually load merchants for orders that have merchantId
    for (const order of orders) {
      if (order.merchantId) {
        const merchant = await Merchant.find(order.merchantId)
        ;(order as any).merchant = merchant
      }
    }

    // Calculate status counts
    const createdCount = orders.filter(o => o.status === 'CREATED').length
    const washingCount = orders.filter(o => o.status === 'WASHING').length
    const readyCount = orders.filter(o => o.status === 'READY').length

    return view.render('admin/orders/index', {
      orders,
      createdCount,
      washingCount,
      readyCount
    })
  }

  // Merchants Management
  async merchantsIndex({ view }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchants = await Merchant.query().orderBy('created_at', 'desc')
    return view.render('admin/merchants/index', { merchants })
  }

  async merchantsCreate({ view }: HttpContext) {
    return view.render('admin/merchants/create')
  }

  async merchantsStore({ request, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default

    const validator = vine.compile(
      vine.object({
        name: vine.string().minLength(3),
        phones: vine.string().minLength(10),
        washingType: vine.enum(['MANUAL', 'MACHINE']),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Parse phone numbers from comma-separated string
      const phoneArray = data.phones
        .split(',')
        .map((phone) => phone.trim())
        .filter((phone) => phone.length > 0)

      if (phoneArray.length === 0) {
        session.flash('error', 'At least one phone number is required')
        return response.redirect().back()
      }

      // Validate phone format
      const phoneRegex = /^\+22901[0-9]{8}$/
      const invalidPhones = phoneArray.filter((phone) => !phoneRegex.test(phone))
      if (invalidPhones.length > 0) {
        session.flash('error', `Invalid phone numbers: ${invalidPhones.join(', ')}`)
        return response.redirect().back()
      }

      await Merchant.create({
        name: data.name,
        phones: phoneArray,
        washingType: data.washingType,
        balance: 0,
        frozenBalance: 0,
      })

      session.flash('success', 'Merchant created successfully')
      return response.redirect().toRoute('admin.merchants.index')
    } catch (error) {
      logger.error("Failed to create new merchant", error)
      session.flash('error', 'Failed to create merchant. Please check your inputs.')
      return response.redirect().back()
    }
  }

  async merchantsEdit({ params, view, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchant = await Merchant.query()
      .where('id', params.id)
      .preload('addresses')
      .first()

    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    return view.render('admin/merchants/edit', { merchant })
  }

  async merchantsUpdate({ params, request, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchant = await Merchant.find(params.id)

    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    const validator = vine.compile(
      vine.object({
        name: vine.string().minLength(3),
        phones: vine.string().minLength(10),
        washingType: vine.enum(['MANUAL', 'MACHINE']),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Parse phone numbers from comma-separated string
      const phoneArray = data.phones
        .split(',')
        .map((phone) => phone.trim())
        .filter((phone) => phone.length > 0)

      if (phoneArray.length === 0) {
        session.flash('error', 'At least one phone number is required')
        return response.redirect().back()
      }

      // Validate phone format
      const phoneRegex = /^\+22901[0-9]{8}$/
      const invalidPhones = phoneArray.filter((phone) => !phoneRegex.test(phone))
      if (invalidPhones.length > 0) {
        session.flash('error', `Invalid phone numbers: ${invalidPhones.join(', ')}`)
        return response.redirect().back()
      }

      merchant.name = data.name
      merchant.phones = phoneArray
      merchant.washingType = data.washingType

      await merchant.save()

      session.flash('success', 'Merchant updated successfully')
      return response.redirect().toRoute('admin.merchants.index')
    } catch (error) {
      logger.error("Failed to update merchant information", error)
      session.flash('error', 'Failed to update merchant')
      return response.redirect().back()
    }
  }

  async merchantsDelete({ params, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchant = await Merchant.find(params.id)

    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    await merchant.delete()

    session.flash('success', 'Merchant deleted successfully')
    return response.redirect().toRoute('admin.merchants.index')
  }

  async merchantDetails({ params, view, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Order = (await import('#models/order')).default
    const Payment = (await import('#models/payment')).default
    const User = (await import('#models/user')).default

    const merchant = await Merchant.query()
      .where('id', params.id)
      .preload('addresses')
      .first()

    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    // Get manager accounts linked to merchant phone numbers
    const managerAccounts = []
    if (merchant.phones && merchant.phones.length > 0) {
      for (const phone of merchant.phones) {
        const user = await User.query()
          .where('phone', phone)
          .where('merchant_id', merchant.id)
          .first()

        managerAccounts.push({
          phone: phone,
          user: user,
          exists: !!user
        })
      }
    }

    // Get orders for this merchant
    const orders = await Order.query()
      .where('merchant_id', merchant.id)
      .orderBy('created_at', 'desc')

    // Calculate statistics
    const completedOrders = orders.filter(order => ['DELIVERED', 'READY'].includes(order.status))
    const totalKg = completedOrders.reduce((sum, order) => {
      const kg = Number(order.userKg || order.capacityKg || 0)
      return sum + kg
    }, 0)

    // Calculate total income - use merchantTotalCost if available, otherwise calculate from merchantKgCost * userKg
    const totalIncome = completedOrders.reduce((sum, order) => {
      let income = 0

      if (order.merchantTotalCost) {
        income = Number(order.merchantTotalCost)
      } else if (order.merchantKgCost && order.userKg) {
        income = Number(order.merchantKgCost) * Number(order.userKg)
      }

      return sum + income
    }, 0)

    // Get withdrawals (payments) for this merchant
    const withdrawals = await Payment.query()
      .where('merchant_id', merchant.id)
      .orderBy('created_at', 'desc')

    const totalWithdrawals = withdrawals.reduce((sum, payment) => {
      const amount = Number(payment.askAmount || 0)
      return sum + amount
    }, 0)
    const successfulWithdrawals = withdrawals.filter(w => w.status === 'SUCCESS')
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING')

    // Order status breakdown
    const ordersByStatus = {
      CREATED: orders.filter(o => o.status === 'CREATED').length,
      STARTED: orders.filter(o => o.status === 'STARTED').length,
      PICKED: orders.filter(o => o.status === 'PICKED').length,
      WASHING: orders.filter(o => o.status === 'WASHING').length,
      READY: orders.filter(o => o.status === 'READY').length,
      DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
    }

    // Format numbers for display
    const formatNumber = (num: number) => {
      if (num === null || num === undefined || isNaN(num)) {
        return '0'
      }
      return new Intl.NumberFormat('fr-FR').format(Math.round(num))
    }

    return view.render('admin/merchants/details', {
      merchant,
      managerAccounts,
      orders,
      withdrawals,
      totalKg: totalKg.toFixed(1),
      totalKgFormatted: formatNumber(totalKg),
      totalIncome: formatNumber(totalIncome),
      totalWithdrawals: formatNumber(totalWithdrawals),
      successfulWithdrawals: successfulWithdrawals.length,
      pendingWithdrawals: pendingWithdrawals.length,
      ordersByStatus,
      completedOrdersCount: completedOrders.length
    })
  }

  // Merchant Address Management
  async merchantAddressCreate({ params, view, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchant = await Merchant.find(params.merchantId)

    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    return view.render('admin/merchants/addresses/create', { merchant })
  }

  async merchantAddressStore({ params, request, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Adress = (await import('#models/adress')).default

    const merchant = await Merchant.find(params.merchantId)
    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    const validator = vine.compile(
      vine.object({
        quartier: vine.string().minLength(2),
        commune: vine.string().minLength(2),
        arrondissement: vine.string().minLength(2),
        departement: vine.string().minLength(2),
        description: vine.string().minLength(5),
        country: vine.string().minLength(2),
        contactFullname: vine.string().minLength(3),
        contactPhone: vine.string().minLength(10),
        latitude: vine.string().minLength(1),
        longitude: vine.string().minLength(1),
      })
    )
    try {
      const data = await request.validateUsing(validator)

      await Adress.create({
        quartier: data.quartier,
        commune: data.commune,
        arrondissement: data.arrondissement,
        departement: data.departement,
        description: data.description,
        country: data.country,
        contactFullname: data.contactFullname,
        contactPhone: data.contactPhone,
        merchantId: merchant.id,
        coordinates: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
      })

      session.flash('success', 'Address created successfully')
      return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
    } catch (error) {
      logger.error("Failed to create merchant address", error)
      session.flash('error', 'Failed to create address. Please check your inputs.')
      return response.redirect().back()
    }
  }

  async merchantAddressEdit({ params, view, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Adress = (await import('#models/adress')).default

    const merchant = await Merchant.find(params.merchantId)
    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    const address = await Adress.find(params.id)
    if (!address || address.merchantId !== merchant.id) {
      session.flash('error', 'Address not found')
      return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
    }

    return view.render('admin/merchants/addresses/edit', { merchant, address })
  }

  async merchantAddressUpdate({ params, request, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Adress = (await import('#models/adress')).default

    const merchant = await Merchant.find(params.merchantId)
    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    const address = await Adress.find(params.id)
    if (!address || address.merchantId !== merchant.id) {
      session.flash('error', 'Address not found')
      return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
    }

    const validator = vine.compile(
      vine.object({
        quartier: vine.string().minLength(2),
        commune: vine.string().minLength(2),
        arrondissement: vine.string().minLength(2),
        departement: vine.string().minLength(2),
        description: vine.string().minLength(5),
        country: vine.string().minLength(2),
        contactFullname: vine.string().minLength(3),
        contactPhone: vine.string().minLength(10),
        latitude: vine.string().minLength(1),
        longitude: vine.string().minLength(1),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      address.quartier = data.quartier
      address.commune = data.commune
      address.arrondissement = data.arrondissement
      address.departement = data.departement
      address.description = data.description
      address.country = data.country
      address.contactFullname = data.contactFullname
      address.contactPhone = data.contactPhone
      address.coordinates = {
        latitude: data.latitude,
        longitude: data.longitude,
      }

      await address.save()

      session.flash('success', 'Address updated successfully')
      return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
    } catch (error) {
      logger.error("Failed to update merchant address", error)
      session.flash('error', 'Failed to update address')
      return response.redirect().back()
    }
  }

  async merchantAddressDelete({ params, response, session }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Adress = (await import('#models/adress')).default

    const merchant = await Merchant.find(params.merchantId)
    if (!merchant) {
      session.flash('error', 'Merchant not found')
      return response.redirect().toRoute('admin.merchants.index')
    }

    const address = await Adress.find(params.id)
    if (!address || address.merchantId !== merchant.id) {
      session.flash('error', 'Address not found')
      return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
    }

    await address.delete()

    session.flash('success', 'Address deleted successfully')
    return response.redirect().toRoute('admin.merchants.edit', { id: merchant.id })
  }

  // User Management
  async usersIndex({ view, request }: HttpContext) {
    const User = (await import('#models/user')).default
    const search = request.input('search', '')

    let query = User.query().whereNot("role","ADMIN").orderBy('created_at', 'desc')

    if (search) {
      query = query.where((subQuery) => {
        subQuery
          .whereILike('firstname', `%${search}%`)
          .orWhereILike('lastname', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
          .orWhereILike('phone', `%${search}%`)
      })
    }

    const users = await query.exec()

    return view.render('admin/users/index', { users, search })
  }

  async usersCreate({ view }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const merchants = await Merchant.query().orderBy('name', 'asc')
    return view.render('admin/users/create', { merchants })
  }

  async usersStore({ request, response, session }: HttpContext) {
    const User = (await import('#models/user')).default

    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(2).optional(),
        lastname: vine.string().minLength(2).optional(),
        email: vine.string().email().optional(),
        phone: vine.string().minLength(10).optional(),
        role: vine.enum(['CLIENT', 'CLEANER']),
        merchantId: vine.number().optional(),
        imageUrl: vine.string().optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Validate at least one of firstname, lastname, email, or phone is provided
      if (!data.firstname && !data.lastname && !data.email && !data.phone) {
        session.flash('error', 'At least one of firstname, lastname, email, or phone is required')
        return response.redirect().back()
      }

      await User.create({
        firstname: data.firstname || null,
        lastname: data.lastname || null,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role,
        merchantId: data.merchantId || undefined,
        imageUrl: data.imageUrl || '/default-avatar.png',
        otpHash: null,
        lastDevice: null,
      })

      session.flash('success', 'User created successfully')
      return response.redirect().toRoute('admin.users.index')
    } catch (error) {
      logger.error("Failed to create new user", error)
      session.flash('error', 'Failed to create user. Please check your inputs.')
      return response.redirect().back()
    }
  }

  async usersEdit({ params, view, response, session }: HttpContext) {
    const User = (await import('#models/user')).default
    const Merchant = (await import('#models/merchant')).default

    const user = await User.find(params.id)
    if (!user) {
      session.flash('error', 'User not found')
      return response.redirect().toRoute('admin.users.index')
    }

    const merchants = await Merchant.query().orderBy('name', 'asc')

    return view.render('admin/users/edit', { user, merchants })
  }

  async usersUpdate({ params, request, response, session }: HttpContext) {
    const User = (await import('#models/user')).default

    const user = await User.find(params.id)
    if (!user) {
      session.flash('error', 'User not found')
      return response.redirect().toRoute('admin.users.index')
    }

    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(2).optional(),
        lastname: vine.string().minLength(2).optional(),
        email: vine.string().email().optional(),
        phone: vine.string().minLength(10).optional(),
        role: vine.enum(['CLIENT', 'CLEANER', 'ADMIN']),
        merchantId: vine.number().optional(),
        imageUrl: vine.string().optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Validate at least one of firstname, lastname, email, or phone is provided
      if (!data.firstname && !data.lastname && !data.email && !data.phone) {
        session.flash('error', 'At least one of firstname, lastname, email, or phone is required')
        return response.redirect().back()
      }

      user.firstname = data.firstname || null
      user.lastname = data.lastname || null
      user.email = data.email || null
      user.phone = data.phone || null
      user.role = data.role
      user.merchantId = data.merchantId || null as any

      if (data.imageUrl) {
        user.imageUrl = data.imageUrl
      }

      await user.save()

      session.flash('success', 'User updated successfully')
      return response.redirect().toRoute('admin.users.index')
    } catch (error) {
      logger.error("Failed to update user information", error)
      session.flash('error', 'Failed to update user')
      return response.redirect().back()
    }
  }

  async usersDelete({ params, response, session }: HttpContext) {
    const User = (await import('#models/user')).default
    const user = await User.find(params.id)

    if (!user) {
      session.flash('error', 'User not found')
      return response.redirect().toRoute('admin.users.index')
    }

    await user.delete()

    session.flash('success', 'User deleted successfully')
    return response.redirect().toRoute('admin.users.index')
  }

  // Wallet Management
  async walletDashboard({ view }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Order = (await import('#models/order')).default
    const Payment = (await import('#models/payment')).default
    const Invoice = (await import('#models/invoice')).default
    const PaymentAccount = (await import('#models/payment_account')).default

    // Get all merchants with their balances
    const merchants = await Merchant.all()

    // Calculate total platform balance
    const totalBalance = merchants.reduce((sum, m) => sum + (m.balance || 0), 0)
    const totalFrozenBalance = merchants.reduce((sum, m) => sum + (m.frozenBalance || 0), 0)
    const availableBalance = totalBalance - totalFrozenBalance

    // Get all invoices for volume and revenue calculations
    const allInvoices = await Invoice.all()

    // Total Volume: Sum of all invoices amounts
    const totalVolume = allInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.amount || '0')
    }, 0)

    // Total Revenues: Sum of all margins on invoices
    const totalRevenues = allInvoices.reduce((sum, invoice) => {
      return sum + (invoice.margin || 0)
    }, 0)

    // Get all payments for withdrawals calculation
    const allPayments = await Payment.all()

    // Total Withdrawals: Sum of all transfers
    const totalWithdrawals = allPayments.reduce((sum, payment) => {
      return sum + (payment.askAmount || 0)
    }, 0)

    // Get all payment accounts
    const paymentAccounts = await PaymentAccount.all()

    // Available Balances: Sum of all payment_accounts balances
    const paymentAccountsBalance = paymentAccounts.reduce((sum, account) => {
      return sum + parseFloat(String(account.balance || 0))
    }, 0)

    // Frozen Balances: Sum of all payment_accounts frozen balances
    const paymentAccountsFrozenBalance = paymentAccounts.reduce((sum, account) => {
      return sum + parseFloat(String(account.frozenBalance || 0))
    }, 0)

    // Get completed orders for income analytics
    const completedOrders = await Order.query()
      .whereIn('status', ['DELIVERED', 'READY'])
      .orderBy('created_at', 'desc')
      .limit(100)

    // Calculate total income (margin from orders)
    // If margin is not set, calculate it as the difference between customer price and merchant cost
    const totalIncome = completedOrders.reduce((sum, order) => {
      let margin = order.margin || 0

      // Fallback: calculate margin if not set
      if (!margin && order.customerOrderFinalPrice && order.merchantTotalCost) {
        margin = order.customerOrderFinalPrice - order.merchantTotalCost
      }

      return sum + margin
    }, 0)

    // Get recent payments (withdrawals)
    const recentPayments = await Payment.query()
      .orderBy('created_at', 'desc')
      .limit(10)

    // Calculate monthly income
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthlyOrders = completedOrders.filter(order => {
      const orderDate = order.createdAt.toJSDate()
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear
    })

    // Helper function to get margin from order
    const getOrderMargin = (order: typeof completedOrders[0]) => {
      let margin = order.margin || 0
      if (!margin && order.customerOrderFinalPrice && order.merchantTotalCost) {
        margin = order.customerOrderFinalPrice - order.merchantTotalCost
      }
      return margin
    }

    const monthlyIncome = monthlyOrders.reduce((sum, order) => sum + getOrderMargin(order), 0)

    // Calculate weekly income
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weeklyOrders = completedOrders.filter(order => {
      return order.createdAt.toJSDate() >= oneWeekAgo
    })

    const weeklyIncome = weeklyOrders.reduce((sum, order) => sum + getOrderMargin(order), 0)

    // Calculate daily average
    const dailyAverage = weeklyOrders.length > 0 ? weeklyIncome / 7 : 0

    // Get last 7 days data for chart
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayOrders = completedOrders.filter(order => {
        const orderDate = order.createdAt.toJSDate()
        return orderDate >= date && orderDate < nextDate
      })

      const dayIncome = dayOrders.reduce((sum, order) => sum + getOrderMargin(order), 0)

      last7Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: dayIncome,
        orders: dayOrders.length
      })
    }

    // Format numbers for display
    const formatNumber = (num: number) => {
      if (num === null || num === undefined || isNaN(num)) {
        return '0'
      }
      return new Intl.NumberFormat('fr-FR').format(Math.round(num))
    }

    // Format last 7 days data
    const formattedLast7Days = last7Days.map(day => ({
      ...day,
      income: Math.round(day.income),
      incomeFormatted: formatNumber(day.income)
    }))

    // Find max income for chart scaling
    const maxIncome = Math.max(...last7Days.map(d => d.income), 1)

    return view.render('admin/wallet/dashboard', {
      totalBalance: formatNumber(totalBalance),
      totalFrozenBalance: formatNumber(totalFrozenBalance),
      availableBalance: formatNumber(availableBalance),
      totalIncome: formatNumber(totalIncome),
      monthlyIncome: formatNumber(monthlyIncome),
      weeklyIncome: formatNumber(weeklyIncome),
      dailyAverage: formatNumber(dailyAverage),
      last7Days: formattedLast7Days,
      maxIncome,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        paymentHash: p.paymentHash,
        askAmount: p.askAmount,
        askAmountFormatted: formatNumber(p.askAmount || 0),
        status: p.status,
        comment: p.comment,
        createdAt: p.createdAt,
        createdAtFormatted: p.createdAt.toFormat('dd/MM/yyyy HH:mm')
      })),
      completedOrdersCount: completedOrders.length,
      // New wallet statistics
      totalVolume: formatNumber(totalVolume),
      totalRevenues: formatNumber(totalRevenues),
      totalWithdrawals: formatNumber(totalWithdrawals),
      paymentAccountsBalance: formatNumber(paymentAccountsBalance),
      paymentAccountsFrozenBalance: formatNumber(paymentAccountsFrozenBalance)
    })
  }

  async walletWithdraw({ view }: HttpContext) {
    const Merchant = (await import('#models/merchant')).default
    const Payment = (await import('#models/payment')).default
    const PaymentAccount = (await import('#models/payment_account')).default

    const merchants = await Merchant.all()
    const totalBalance = merchants.reduce((sum, m) => sum + (m.balance || 0), 0)
    const totalFrozenBalance = merchants.reduce((sum, m) => sum + (m.frozenBalance || 0), 0)

    // Get all payment accounts
    const paymentAccounts = await PaymentAccount.all()

    // Available Balance: Sum of all payment_accounts balances
    const availableBalance = paymentAccounts.reduce((sum, account) => {
      return sum + parseFloat(String(account.balance || 0))
    }, 0)

    // Get withdrawal history
    const withdrawals = await Payment.query()
      .orderBy('created_at', 'desc')
      .limit(20)

    return view.render('admin/wallet/withdraw', {
      availableBalance,
      totalBalance,
      totalFrozenBalance,
      withdrawals
    })
  }

  async walletWithdrawStore({ request, response, session, auth }: HttpContext) {
    const Payment = (await import('#models/payment')).default
    const Merchant = (await import('#models/merchant')).default
    const User = (await import('#models/user')).default
    const speakeasy = await import('speakeasy')

    const validator = vine.compile(
      vine.object({
        amount: vine.number().min(1),
        receivingAddress: vine.string().minLength(10),
        comment: vine.string().optional(),
        otp: vine.string().minLength(6).maxLength(6),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Get authenticated user
      const authUser = auth.use('web').user
      if (!authUser) {
        session.flash('error', 'Please login to continue')
        return response.redirect().toRoute('auth.login')
      }

      // Reload user to get 2FA fields
      const user = await User.find(authUser.id)
      if (!user) {
        session.flash('error', 'User not found')
        return response.redirect().back()
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled !== true || !user.twoFactorSecret) {
        session.flash('error', 'Two-factor authentication is not enabled. Please enable it in settings first.')
        return response.redirect().toRoute('admin.settings.index')
      }

      // Verify OTP code
      const verified = speakeasy.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: data.otp,
        window: 2,
      })

      if (!verified) {
        session.flash('error', 'Invalid OTP code. Please check your authenticator app and try again.')
        return response.redirect().back()
      }

      // Check available balance
      const merchants = await Merchant.all()
      const totalBalance = merchants.reduce((sum, m) => sum + (m.balance || 0), 0)
      const totalFrozenBalance = merchants.reduce((sum, m) => sum + (m.frozenBalance || 0), 0)
      const availableBalance = totalBalance - totalFrozenBalance

      if (data.amount > availableBalance) {
        session.flash('error', 'Insufficient available balance')
        return response.redirect().back()
      }

      // Create withdrawal payment
      await Payment.create({
        askAmount: data.amount,
        sentAmount: 0,
        recevingAdress: data.receivingAddress,
        status: 'CREATED',
        comment: data.comment || 'Admin withdrawal',
        merchantId: 0, // System withdrawal
        userId: user.id,
        paymentHash: `WITHDRAW-${Date.now()}`,
        networkFees: 0,
        serviceFees: 0,
        paymentAccountId: 1,
        adressId: 0,
      } as any)

      session.flash('success', 'Withdrawal request created successfully')
      return response.redirect().toRoute('admin.wallet.withdraw')
    } catch (error) {
      logger.error("Failed to create wallet withdrawal request", error)
      session.flash('error', 'Failed to create withdrawal request')
      return response.redirect().back()
    }
  }

  async walletTransactions({ view, request }: HttpContext) {
    const Payment = (await import('#models/payment')).default
    const search = request.input('search', '')
    const status = request.input('status', '')

    let query = Payment.query().orderBy('created_at', 'desc')

    if (search) {
      query = query.where((subQuery) => {
        subQuery
          .whereILike('payment_hash', `%${search}%`)
          .orWhereILike('receving_adress', `%${search}%`)
          .orWhereILike('comment', `%${search}%`)
      })
    }

    if (status) {
      query = query.where('status', status)
    }

    const transactions = await query.exec()

    return view.render('admin/wallet/transactions', {
      transactions,
      search,
      status
    })
  }

  async walletTransactionDetails({ params, view, response, session }: HttpContext) {
    const Payment = (await import('#models/payment')).default

    const transaction = await Payment.find(params.id)

    if (!transaction) {
      session.flash('error', 'Transaction not found')
      return response.redirect().toRoute('admin.wallet.transactions')
    }

    return view.render('admin/wallet/transaction-details', { transaction })
  }

  // Order Scheduling & Delivery
  async schedulingCalendar({ view, request }: HttpContext) {
    const Order = (await import('#models/order')).default
    const { DateTime } = await import('luxon')

    // Get current month or requested month
    const year = request.input('year', DateTime.now().year)
    const month = request.input('month', DateTime.now().month)

    const startOfMonth = DateTime.fromObject({ year, month, day: 1 })
    const endOfMonth = startOfMonth.endOf('month')

    // Get all orders for the month
    const orders = await Order.query()
      .whereBetween('delivery_date', [
        startOfMonth.toSQLDate()!,
        endOfMonth.toSQLDate()!
      ])
      .whereNotNull('delivery_date')
      .orderBy('delivery_date', 'asc')

    // Group orders by date
    const ordersByDate: { [key: string]: number } = {}
    orders.forEach(order => {
      if (order.deliveryDate) {
        const dateKey = order.deliveryDate.toFormat('yyyy-MM-dd')
        ordersByDate[dateKey] = (ordersByDate[dateKey] || 0) + 1
      }
    })

    // Build calendar data
    const calendarDays = []
    const startDay = startOfMonth.weekday === 7 ? 0 : startOfMonth.weekday // Sunday = 0

    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      calendarDays.push({ day: null, date: null, orderCount: 0 })
    }

    // Add days of month
    for (let day = 1; day <= endOfMonth.day; day++) {
      const date = DateTime.fromObject({ year, month, day })
      const dateKey = date.toFormat('yyyy-MM-dd')
      calendarDays.push({
        day,
        date: dateKey,
        orderCount: ordersByDate[dateKey] || 0,
        isToday: date.hasSame(DateTime.now(), 'day')
      })
    }

    const prevMonth = startOfMonth.minus({ months: 1 })
    const nextMonth = startOfMonth.plus({ months: 1 })
    const currentDate = DateTime.now()

    return view.render('admin/scheduling/calendar', {
      calendarDays,
      currentMonth: startOfMonth.toFormat('MMMM yyyy'),
      year,
      month,
      prevMonth: { year: prevMonth.year, month: prevMonth.month },
      nextMonth: { year: nextMonth.year, month: nextMonth.month },
      currentYear: currentDate.year,
      currentMonthNum: currentDate.month
    })
  }

  async schedulingList({ view }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Merchant = (await import('#models/merchant')).default
    const { DateTime } = await import('luxon')

    const now = DateTime.now()
    const startOfWeek = now.startOf('week')
    const endOfWeek = now.endOf('week')

    // Get current week orders
    const currentWeekOrders = await Order.query()
      .whereBetween('delivery_date', [
        startOfWeek.toSQLDate()!,
        endOfWeek.toSQLDate()!
      ])
      .whereNotNull('delivery_date')
      .preload('user')
      .orderBy('delivery_date', 'asc')

    // Load merchants for current week orders
    for (const order of currentWeekOrders) {
      if (order.merchantId) {
        const merchant = await Merchant.find(order.merchantId)
        ;(order as any).merchant = merchant
      }
    }

    // Get past orders grouped by week and month
    const pastOrders = await Order.query()
      .where('delivery_date', '<', startOfWeek.toSQLDate()!)
      .whereNotNull('delivery_date')
      .preload('user')
      .orderBy('delivery_date', 'desc')
      .limit(100)

    // Load merchants for past orders
    for (const order of pastOrders) {
      if (order.merchantId) {
        const merchant = await Merchant.find(order.merchantId)
        ;(order as any).merchant = merchant
      }
    }

    // Group past orders by month and week - using array structure for easier template iteration
    const groupedPastOrdersArray: Array<{
      monthKey: string
      monthLabel: string
      weeks: Array<{
        weekLabel: string
        weekId: string
        orders: typeof pastOrders
      }>
    }> = []

    const monthsMap: { [key: string]: number } = {}

    pastOrders.forEach(order => {
      if (!order.deliveryDate) return // Skip orders without delivery date

      const monthKey = order.deliveryDate.toFormat('yyyy-MM')
      const monthLabel = order.deliveryDate.toFormat('MMMM yyyy')
      const weekStart = order.deliveryDate.startOf('week')
      const weekEnd = order.deliveryDate.endOf('week')
      const weekLabel = `${weekStart.toFormat('dd MMM')} - ${weekEnd.toFormat('dd MMM')}`
      const weekId = `${monthKey}-${weekStart.toFormat('yyyy-MM-dd')}`

      // Find or create month
      if (monthsMap[monthKey] === undefined) {
        monthsMap[monthKey] = groupedPastOrdersArray.length
        groupedPastOrdersArray.push({
          monthKey,
          monthLabel,
          weeks: []
        })
      }

      const monthIndex = monthsMap[monthKey]
      const month = groupedPastOrdersArray[monthIndex]

      // Find or create week
      let week = month.weeks.find(w => w.weekLabel === weekLabel)
      if (!week) {
        week = { weekLabel, weekId, orders: [] }
        month.weeks.push(week)
      }

      week.orders.push(order)
    })

    return view.render('admin/scheduling/list', {
      currentWeekOrders,
      groupedPastOrders: groupedPastOrdersArray,
      currentWeekLabel: `${startOfWeek.toFormat('dd MMM')} - ${endOfWeek.toFormat('dd MMM yyyy')}`
    })
  }

  async schedulingOrdersByDate({ params, view }: HttpContext) {
    const Order = (await import('#models/order')).default
    const { DateTime } = await import('luxon')

    const date = params.date
    const dateObj = DateTime.fromISO(date)

    const orders = await Order.query()
      .where('delivery_date', '>=', dateObj.startOf('day').toSQL()!)
      .where('delivery_date', '<=', dateObj.endOf('day').toSQL()!)
      .whereNotNull('delivery_date')
      .preload('user')
      .preload('merchant')
      .preload('package')
      .orderBy('delivery_date', 'asc')

    return view.render('admin/scheduling/orders-by-date', {
      orders,
      date: dateObj.toFormat('dd MMMM yyyy')
    })
  }

  async schedulingOrderDetails({ params, view, response, session }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Adress = (await import('#models/adress')).default
    const Merchant = (await import('#models/merchant')).default
    const Invoice = (await import('#models/invoice')).default

    const order = await Order.query()
      .where('id', params.id)
      .preload('user')
      .preload('package')
      .first()

    if (!order) {
      session.flash('error', 'Order not found')
      return response.redirect().toRoute('admin.scheduling.calendar')
    }

    // Manually load command if commandId exists
    const Command = (await import('#models/command')).default
    if (order.commandId) {
      const command = await Command.find(order.commandId)
      ;(order as any).command = command
    }

    // Manually load merchant if merchantId exists
    if (order.merchantId) {
      const merchant = await Merchant.find(order.merchantId)
      ;(order as any).merchant = merchant
    }

    // Manually load invoice if invoiceId exists
    if (order.invoiceId) {
      const invoice = await Invoice.find(order.invoiceId)
      ;(order as any).invoice = invoice
    }

    // Parse addons JSON if it exists
    let parsedAddons = null
    if (order.addons) {
      try {
        parsedAddons = typeof order.addons === 'string'
          ? JSON.parse(order.addons)
          : order.addons
      } catch (e) {
        logger.error("Failed to parse order addons JSON", e)
        parsedAddons = null
      }
    }

    // Get user address
    let userAddress = null
    if (order.userId) {
      userAddress = await Adress.query()
        .where('user_id', order.userId)
        .first()
    }

    // Get merchant addresses
    let merchantAddresses: any[] = []
    if (order.merchantId) {
      merchantAddresses = await Adress.query()
        .where('merchant_id', order.merchantId)
    }

    return view.render('admin/scheduling/order-details', {
      order,
      userAddress,
      merchantAddresses,
      addons: parsedAddons
    })
  }

  async deliveryAssignments({ view, request }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Merchant = (await import('#models/merchant')).default
    const Adress = (await import('#models/adress')).default
    const { DateTime } = await import('luxon')

    // Get page from query string
    const page = request.input('page', 1)
    const perPage = 20

    // Get orders for upcoming deliveries (next 7 days)
    const now = DateTime.now()
    const endDate = now.plus({ days: 7 })

    const ordersPaginated = await Order.query()
      .whereBetween('delivery_date', [
        now.toSQLDate()!,
        endDate.toSQLDate()!
      ])
      .whereNotNull('delivery_date')
      .preload('user')
      .orderBy('delivery_date', 'asc')
      .paginate(page, perPage)

    const orders = ordersPaginated.all()

    // Load command, merchant and addresses for orders
    const Command = (await import('#models/command')).default
    for (const order of orders) {
      // Load command if commandId exists
      if (order.commandId) {
        const command = await Command.find(order.commandId)
        ;(order as any).command = command
      }

      // Load merchant if merchantId exists
      if (order.merchantId) {
        const merchant = await Merchant.query()
          .where('id', order.merchantId)
          .preload('addresses')
          .first()
        ;(order as any).merchant = merchant
      }

      // Load user addresses
      if (order.userId) {
        const userAddress = await Adress.query().where('user_id', order.userId).first()
        ;(order as any).userAddress = userAddress
      }
    }

    // Get all merchants with their addresses
    const merchants = await Merchant.query().preload('addresses')

    return view.render('admin/scheduling/delivery-assignments', {
      orders,
      merchants,
      pagination: ordersPaginated.getMeta()
    })
  }

  async deliveryAssign({ request, response, session }: HttpContext) {
    const Order = (await import('#models/order')).default

    const validator = vine.compile(
      vine.object({
        orderId: vine.number(),
        merchantId: vine.number()
      })
    )

    try {
      const data = await request.validateUsing(validator)

      const order = await Order.find(data.orderId)
      if (!order) {
        session.flash('error', 'Order not found')
        return response.redirect().toRoute('admin.delivery.assignments')
      }

      order.merchantId = data.merchantId
      await order.save()

      session.flash('success', 'Merchant assigned successfully')
      return response.redirect().toRoute('admin.delivery.assignments')
    } catch (error) {
      logger.error("Failed to assign merchant to delivery order", error)
      session.flash('error', 'Failed to assign merchant')
      return response.redirect().toRoute('admin.delivery.assignments')
    }
  }

  async deliveryExportPdf({ request, response }: HttpContext) {
    const Order = (await import('#models/order')).default
    const Adress = (await import('#models/adress')).default
    const { DateTime } = await import('luxon')

    // Get selected order IDs from query
    const orderIdsInput = request.input('orderIds', '')
    const orderIds = Array.isArray(orderIdsInput)
      ? orderIdsInput
      : (typeof orderIdsInput === 'string' ? orderIdsInput.split(',').filter((id: string) => id) : [])

    if (orderIds.length === 0) {
      return response.badRequest({ error: 'No orders selected' })
    }

    const orders = await Order.query()
      .whereIn('id', orderIds)
      .preload('user')
      .preload('package')
      .orderBy('delivery_date', 'asc')

    // Load command, merchant, and user addresses for each order
    const Command = (await import('#models/command')).default
    const Merchant = (await import('#models/merchant')).default
    for (const order of orders) {
      // Load command if commandId exists
      if (order.commandId) {
        const command = await Command.find(order.commandId)
        ;(order as any).command = command
      }

      // Load merchant with addresses if merchantId exists
      if (order.merchantId) {
        const merchant = await Merchant.query()
          .where('id', order.merchantId)
          .preload('addresses')
          .first()
        ;(order as any).merchant = merchant
      }

      // Load user address
      if (order.userId) {
        const userAddress = await Adress.query().where('user_id', order.userId).first()
        ;(order as any).userAddress = userAddress
      }
    }

    // For now, return HTML that can be printed as PDF
    // In production, you'd use a library like puppeteer or pdfkit
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Delivery Schedule - ${DateTime.now().toFormat('dd-MM-yyyy')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 20px; text-align: center; }
    .order-block { page-break-inside: avoid; margin-bottom: 30px; border: 2px solid #000; }
    .order-header { background: #000; color: #fff; padding: 10px; font-weight: bold; }
    .order-content { display: flex; border-top: 2px solid #000; }
    .order-left, .order-right { flex: 1; padding: 15px; }
    .order-left { border-right: 2px solid #000; }
    .section-title { font-weight: bold; font-size: 13px; margin-bottom: 8px; margin-top: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .section-title:first-child { margin-top: 0; }
    .info-row { margin-bottom: 6px; }
    .info-label { font-weight: bold; display: inline-block; width: 120px; }
    .info-value { display: inline-block; }
    @media print {
      body { padding: 10px; }
      .order-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>DELIVERY SCHEDULE - ${DateTime.now().toFormat('dd MMMM yyyy')}</h1>
  ${orders.map((order: any) => `
    <div class="order-block">
      <div class="order-header">
        ORDER #${order.orderId} - ${order.deliveryDate.toFormat('dd/MM/yyyy HH:mm')}
      </div>
      <div class="order-content">
        <div class="order-left">
          <div class="section-title">ORDER DETAILS</div>
          <div class="info-row">
            <span class="info-label">Order ID:</span>
            <span class="info-value">${order.orderId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">${order.orderType}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">${order.status}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Weight:</span>
            <span class="info-value">${order.userKg || order.capacityKg || 'N/A'} kg</span>
          </div>
          <div class="info-row">
            <span class="info-label">Package:</span>
            <span class="info-value">${order.orderTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Delivery Date:</span>
            <span class="info-value">${order.deliveryDate.toFormat('dd/MM/yyyy')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Picking Time:</span>
            <span class="info-value"><strong>${order.pickingHours && order.pickingHours.length >= 2 ? `${order.pickingHours[0]} - ${order.pickingHours[1]}` : 'N/A'}</strong></span>
          </div>

          <div class="section-title">CUSTOMER DETAILS</div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${order.user?.firstname || ''} ${order.user?.lastname || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${order.user?.phone || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${order.user?.email || 'N/A'}</span>
          </div>

          ${(order as any).userAddress ? `
          <div class="section-title">PICKUP/DELIVERY ADDRESS</div>
          <div class="info-row">
            <span class="info-label">Quartier:</span>
            <span class="info-value">${(order as any).userAddress.quartier || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Commune:</span>
            <span class="info-value">${(order as any).userAddress.commune || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Arrondissement:</span>
            <span class="info-value">${(order as any).userAddress.arrondissement || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact:</span>
            <span class="info-value">${(order as any).userAddress.contactFullname || 'N/A'} - ${(order as any).userAddress.contactPhone || 'N/A'}</span>
          </div>
          ${(order as any).userAddress.description ? `
          <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value">${(order as any).userAddress.description}</span>
          </div>
          ` : ''}
          ` : ''}
        </div>

        <div class="order-right">
          ${order.merchant ? `
          <div class="section-title">MERCHANT DETAILS</div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${order.merchant.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">${order.merchant.washingType}</span>
          </div>
          ${order.merchant.phones && order.merchant.phones.length > 0 ? `
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${order.merchant.phones[0]}</span>
          </div>
          ` : ''}

          ${order.merchant.addresses && order.merchant.addresses.length > 0 ? `
          <div class="section-title">WASHING STORE LOCATION</div>
          ${order.merchant.addresses.map((addr: any) => `
            <div style="margin-bottom: 10px; padding: 8px; background: #f5f5f5;">
              <div class="info-row">
                <span class="info-label">Quartier:</span>
                <span class="info-value">${addr.quartier || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Commune:</span>
                <span class="info-value">${addr.commune || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Arrondissement:</span>
                <span class="info-value">${addr.arrondissement || 'N/A'}</span>
              </div>
              ${addr.description ? `
              <div class="info-row">
                <span class="info-label">Description:</span>
                <span class="info-value">${addr.description}</span>
              </div>
              ` : ''}
            </div>
          `).join('')}
          ` : ''}
          ` : `
          <div class="section-title">MERCHANT DETAILS</div>
          <div style="padding: 20px; text-align: center; color: #999;">
            No merchant assigned yet
          </div>
          `}
        </div>
      </div>
    </div>
  `).join('')}

  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>
    `

    return response.header('Content-Type', 'text/html').send(html)
  }

  // Admin Permissions Management
  async adminPermissions({ params, view }: HttpContext) {
    const Permission = (await import('#models/permission')).default

    // Get the admin user
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').firstOrFail()

    // Load admin's current permissions
    await admin.load('permissions')

    // Get all available permissions grouped by module
    const allPermissions = await Permission.query().orderBy('module').orderBy('action')

    // Group permissions by module
    const groupedPermissions: Record<string, typeof allPermissions> = {}
    for (const permission of allPermissions) {
      if (!groupedPermissions[permission.module]) {
        groupedPermissions[permission.module] = []
      }
      groupedPermissions[permission.module].push(permission)
    }

    // Get IDs of permissions admin currently has
    const adminPermissionIds = admin.permissions.map((p) => p.id)

    return view.render('admin/admins/permissions', {
      admin,
      groupedPermissions,
      adminPermissionIds,
    })
  }

  async adminPermissionsUpdate({ params, request, response, session }: HttpContext) {
    // Get the admin user
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').firstOrFail()

    // Get selected permission IDs from the form
    const permissionIds = request.input('permissions', [])

    // Sync permissions (this will remove old ones and add new ones)
    await admin.related('permissions').sync(permissionIds)

    session.flash('success', 'Permissions updated successfully')
    return response.redirect().toRoute('admin.admins.permissions', { id: admin.id })
  }

  // Contacts Management
  async contactsIndex({ view }: HttpContext) {
    const Contact = (await import('#models/contact')).default

    const contacts = await Contact.query().orderBy('created_at', 'desc')

    const unreadCount = contacts.filter(c => !c.isRead).length
    const totalCount = contacts.length

    return view.render('admin/contacts/index', {
      contacts,
      unreadCount,
      totalCount
    })
  }

  async contactShow({ params, view }: HttpContext) {
    const Contact = (await import('#models/contact')).default

    const contact = await Contact.findOrFail(params.id)

    // Mark as read if not already read
    if (!contact.isRead) {
      contact.isRead = true
      contact.readAt = DateTime.now()
      await contact.save()
    }

    return view.render('admin/contacts/show', { contact })
  }

  async contactDelete({ params, response, session }: HttpContext) {
    const Contact = (await import('#models/contact')).default

    const contact = await Contact.findOrFail(params.id)
    await contact.delete()

    session.flash('success', 'Contact deleted successfully')
    return response.redirect().toRoute('admin.contacts.index')
  }

  async contactToggleRead({ params, response, session }: HttpContext) {
    const Contact = (await import('#models/contact')).default

    const contact = await Contact.findOrFail(params.id)
    contact.isRead = !contact.isRead
    contact.readAt = contact.isRead ? DateTime.now() : null
    await contact.save()

    session.flash('success', `Contact marked as ${contact.isRead ? 'read' : 'unread'}`)
    return response.redirect().back()
  }
}
