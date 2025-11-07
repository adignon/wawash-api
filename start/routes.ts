/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
const AuthController = () => import("#controllers/auth_controller")
const SubscriptionController = () => import("#controllers/subscriptions_controller")
const PackagesController = () => import("#controllers/packages_controller")
const OrderController = () => import("#controllers/orders_controller")
const AdminController = () => import("#controllers/admin_controller")
const PaymentController = () => import("#controllers/payments_controller")
const MerchantsController = () => import("#controllers/merchants_controller")
const FrontController = () => import("#controllers/fronts_controller")
const PartnersController = () => import("#controllers/partners_controller")
router.group(() => {
  router.post("/auth/access/verify", [AuthController, "otpVerificationPhone"])
  router.post("/auth/access/confirm", [AuthController, "otpConfirmCode"])
  router.post("/auth/create", [AuthController, "createUserAccount"])
  router.group(() => {
    router.post("/address", [SubscriptionController, "saveAdress"])
    router.get("/address", [SubscriptionController, "getAdress"])
    router.get("/packages/addons", [PackagesController, "getServicesAddons"])
    router.post("/packages/subscribe", [SubscriptionController, "subscribe"])
    router.post("/packages/command", [SubscriptionController, "commandOrder"])
    router.post("/packages/command/pay/:orderId", [SubscriptionController, "checkCommandOrderPayment"])
    router.get("/packages/:type?", [PackagesController, "getPackages"])
    router.get("/subscription/payment/:commandId", [SubscriptionController, "checkPayment"])
    router.post("/subscription/cancel", [SubscriptionController, "cancelActiveSubscription"])
    router.get("/histories", [OrderController, "getOrderHistories"])
    router.get("/orders/:orderId", [OrderController, "getOrder"])
    router.post("/orders/:orderId/delivered", [OrderController, "customerConfirmOrderReception"])

    router.group(() => {
      router.post("/order/accept", [OrderController, "merchantEvaluateOrder"])
      router.post("/order/submit", [OrderController, "merchantOrderAction"])
      router.get("/balance/me", [MerchantsController, "getBalanceMerchant"])
      router.post("/checkout/adresses", [PaymentController, "addOrEditUserPaymentMethod"])
      router.get("/checkout/adresses", [PaymentController, "getAddresses"])
      router.post("/payments/withdraw", [PaymentController, "createPayment"])
      router.get("/payments", [PaymentController, "getPayments"])
      router.get("/payments/methods", [PaymentController, "getPaymentMethods"])
      router.get("/payments/:paymentId", [PaymentController, "getPayment"])
      router.get("/statistics", [MerchantsController, "getMerchantStatistics"])
    })
      .prefix("merchants")
      .use([
        middleware.userIs("CLEANER")
      ])

  }).use([
    middleware.auth(),
    middleware.deviceCheck({ authicationCheck: true })
  ])
})
  .prefix("api")
  .use([
    middleware.deviceCheck({ authicationCheck: false })
  ])
  

// Admin Routes
router.group(() => {
  // Login routes (no auth required)
  router.get('/login', [AdminController, 'showLogin']).as('admin.login')
  router.post('/login', [AdminController, 'login']).as('admin.login.post')

  // 2FA routes (no auth required, session-based)
  router.get('/2fa/setup', [AdminController, 'show2FASetup']).as('admin.2fa.setup')
  router.post('/2fa/setup', [AdminController, 'complete2FASetup']).as('admin.2fa.setup.complete')
  router.get('/2fa/verify', [AdminController, 'show2FAVerify']).as('admin.2fa.verify')
  router.post('/2fa/verify', [AdminController, 'verifyLogin2FA']).as('admin.2fa.verify.post')

  // Protected admin routes
  router.group(() => {
    router.get('/dashboard', [AdminController, 'dashboard']).as('admin.dashboard').use(middleware.permission({ permissions: 'dashboard.view' }))
    router.get('/no-permissions', [AdminController, 'noPermissions']).as('admin.no-permissions')
    router.post('/logout', [AdminController, 'logout']).as('admin.logout')

    // Admin management
    router.get('/admins', [AdminController, 'index']).as('admin.admins.index').use(middleware.permission({ permissions: 'admins.read' }))
    router.get('/admins/create', [AdminController, 'create']).as('admin.admins.create').use(middleware.permission({ permissions: 'admins.create' }))
    router.post('/admins', [AdminController, 'store']).as('admin.admins.store').use(middleware.permission({ permissions: 'admins.create' }))
    router.get('/admins/:id/edit', [AdminController, 'edit']).as('admin.admins.edit').use(middleware.permission({ permissions: 'admins.update' }))
    router.post('/admins/:id', [AdminController, 'update']).as('admin.admins.update').use(middleware.permission({ permissions: 'admins.update' }))
    router.post('/admins/:id/delete', [AdminController, 'delete']).as('admin.admins.delete').use(middleware.permission({ permissions: 'admins.delete' }))
    router.get('/admins/:id/permissions', [AdminController, 'adminPermissions']).as('admin.admins.permissions').use(middleware.permission({ permissions: 'admins.permissions' }))
    router.post('/admins/:id/permissions', [AdminController, 'adminPermissionsUpdate']).as('admin.admins.permissions.update').use(middleware.permission({ permissions: 'admins.permissions' }))

    // Packages management
    router.get('/packages', [AdminController, 'packagesIndex']).as('admin.packages.index').use(middleware.permission({ permissions: 'packages.read' }))
    router.get('/packages/:id/edit', [AdminController, 'packagesEdit']).as('admin.packages.edit').use(middleware.permission({ permissions: 'packages.update' }))
    router.post('/packages/:id', [AdminController, 'packagesUpdate']).as('admin.packages.update').use(middleware.permission({ permissions: 'packages.update' }))

    // Configuration management
    router.get('/config', [AdminController, 'configIndex']).as('admin.config.index').use(middleware.permission({ permissions: 'config.read' }))
    router.post('/config/:id', [AdminController, 'configUpdate']).as('admin.config.update').use(middleware.permission({ permissions: 'config.update' }))

    // User Settings (2FA, Profile, etc.)
    router.get('/settings', [AdminController, 'settingsIndex']).as('admin.settings.index').use(middleware.permission({ permissions: 'settings.view' }))
    router.post('/settings/2fa/enable', [AdminController, 'enable2FA']).as('admin.settings.2fa.enable').use(middleware.permission({ permissions: 'settings.2fa' }))
    router.post('/settings/2fa/verify', [AdminController, 'verify2FA']).as('admin.settings.2fa.verify').use(middleware.permission({ permissions: 'settings.2fa' }))
    router.post('/settings/2fa/disable', [AdminController, 'disable2FA']).as('admin.settings.2fa.disable').use(middleware.permission({ permissions: 'settings.2fa' }))

    // Merchant management
    router.get('/merchants', [AdminController, 'merchantsIndex']).as('admin.merchants.index').use(middleware.permission({ permissions: 'merchants.read' }))
    router.get('/merchants/create', [AdminController, 'merchantsCreate']).as('admin.merchants.create').use(middleware.permission({ permissions: 'merchants.create' }))
    router.post('/merchants', [AdminController, 'merchantsStore']).as('admin.merchants.store').use(middleware.permission({ permissions: 'merchants.create' }))
    router.get('/merchants/:id', [AdminController, 'merchantDetails']).as('admin.merchants.details').use(middleware.permission({ permissions: 'merchants.read' }))
    router.get('/merchants/:id/edit', [AdminController, 'merchantsEdit']).as('admin.merchants.edit').use(middleware.permission({ permissions: 'merchants.update' }))
    router.post('/merchants/:id', [AdminController, 'merchantsUpdate']).as('admin.merchants.update').use(middleware.permission({ permissions: 'merchants.update' }))
    router.post('/merchants/:id/delete', [AdminController, 'merchantsDelete']).as('admin.merchants.delete').use(middleware.permission({ permissions: 'merchants.delete' }))

    // Merchant addresses management
    router.get('/merchants/:merchantId/addresses/create', [AdminController, 'merchantAddressCreate']).as('admin.merchant.address.create').use(middleware.permission({ permissions: 'merchants.addresses' }))
    router.post('/merchants/:merchantId/addresses', [AdminController, 'merchantAddressStore']).as('admin.merchant.address.store').use(middleware.permission({ permissions: 'merchants.addresses' }))
    router.get('/merchants/:merchantId/addresses/:id/edit', [AdminController, 'merchantAddressEdit']).as('admin.merchant.address.edit').use(middleware.permission({ permissions: 'merchants.addresses' }))
    router.post('/merchants/:merchantId/addresses/:id', [AdminController, 'merchantAddressUpdate']).as('admin.merchant.address.update').use(middleware.permission({ permissions: 'merchants.addresses' }))
    router.post('/merchants/:merchantId/addresses/:id/delete', [AdminController, 'merchantAddressDelete']).as('admin.merchant.address.delete').use(middleware.permission({ permissions: 'merchants.addresses' }))

    // User management
    router.get('/users', [AdminController, 'usersIndex']).as('admin.users.index').use(middleware.permission({ permissions: 'users.read' }))
    router.get('/users/create', [AdminController, 'usersCreate']).as('admin.users.create').use(middleware.permission({ permissions: 'users.create' }))
    router.post('/users', [AdminController, 'usersStore']).as('admin.users.store').use(middleware.permission({ permissions: 'users.create' }))
    router.get('/users/:id/edit', [AdminController, 'usersEdit']).as('admin.users.edit').use(middleware.permission({ permissions: 'users.update' }))
    router.post('/users/:id', [AdminController, 'usersUpdate']).as('admin.users.update').use(middleware.permission({ permissions: 'users.update' }))
    router.post('/users/:id/delete', [AdminController, 'usersDelete']).as('admin.users.delete').use(middleware.permission({ permissions: 'users.delete' }))

    // Subscriptions & Orders
    router.get('/subscriptions', [AdminController, 'subscriptions']).as('admin.subscriptions.index').use(middleware.permission({ permissions: 'subscriptions.read' }))
    router.get('/orders', [AdminController, 'orders']).as('admin.orders.index').use(middleware.permission({ permissions: 'orders.read' }))

    // Order Scheduling & Delivery
    router.get('/scheduling', [AdminController, 'schedulingCalendar']).as('admin.scheduling.calendar').use(middleware.permission({ permissions: 'scheduling.view' }))
    router.get('/scheduling/list', [AdminController, 'schedulingList']).as('admin.scheduling.list').use(middleware.permission({ permissions: 'scheduling.read' }))
    router.get('/scheduling/orders/:date', [AdminController, 'schedulingOrdersByDate']).as('admin.scheduling.orders.date').use(middleware.permission({ permissions: 'scheduling.read' }))
    router.get('/scheduling/order/:id', [AdminController, 'schedulingOrderDetails']).as('admin.scheduling.order.details').use(middleware.permission({ permissions: 'scheduling.read' }))
    router.get('/delivery/assignments', [AdminController, 'deliveryAssignments']).as('admin.delivery.assignments').use(middleware.permission({ permissions: 'delivery.read' }))
    router.post('/delivery/assign', [AdminController, 'deliveryAssign']).as('admin.delivery.assign').use(middleware.permission({ permissions: 'delivery.assign' }))
    router.get('/delivery/export/pdf', [AdminController, 'deliveryExportPdf']).as('admin.delivery.export.pdf').use(middleware.permission({ permissions: 'delivery.export' }))

    // Wallet management
    router.get('/wallet', [AdminController, 'walletDashboard']).as('admin.wallet.dashboard').use(middleware.permission({ permissions: 'wallet.read' }))
    router.get('/wallet/withdraw', [AdminController, 'walletWithdraw']).as('admin.wallet.withdraw').use(middleware.permission({ permissions: 'wallet.withdraw' }))
    router.post('/wallet/withdraw', [AdminController, 'walletWithdrawStore']).as('admin.wallet.withdraw.store').use(middleware.permission({ permissions: 'wallet.withdraw' }))
    router.get('/wallet/transactions', [AdminController, 'walletTransactions']).as('admin.wallet.transactions').use(middleware.permission({ permissions: 'wallet.transactions' }))
    router.get('/wallet/transactions/:id', [AdminController, 'walletTransactionDetails']).as('admin.wallet.transaction.details').use(middleware.permission({ permissions: 'wallet.transactions' }))

    // Contacts Management
    router.get('/contacts', [AdminController, 'contactsIndex']).as('admin.contacts.index').use(middleware.permission({ permissions: 'contacts.read' }))
    router.get('/contacts/:id', [AdminController, 'contactShow']).as('admin.contacts.show').use(middleware.permission({ permissions: 'contacts.read' }))
    router.post('/contacts/:id/toggle-read', [AdminController, 'contactToggleRead']).as('admin.contacts.toggle-read').use(middleware.permission({ permissions: 'contacts.update' }))
    router.delete('/contacts/:id', [AdminController, 'contactDelete']).as('admin.contacts.delete').use(middleware.permission({ permissions: 'contacts.delete' }))

    // Partners Management
    router.get('/partners', [PartnersController, 'index']).as('admin.partners.index').use(middleware.permission({ permissions: 'partners.read' }))
    router.get('/partners/:id', [PartnersController, 'show']).as('admin.partners.show').use(middleware.permission({ permissions: 'partners.read' }))
    router.get('/partners/:id/edit', [PartnersController, 'edit']).as('admin.partners.edit').use(middleware.permission({ permissions: 'partners.update' }))
    router.post('/partners/:id', [PartnersController, 'update']).as('admin.partners.update').use(middleware.permission({ permissions: 'partners.update' }))
    router.post('/partners/:id/delete', [PartnersController, 'destroy']).as('admin.partners.delete').use(middleware.permission({ permissions: 'partners.delete' }))
  }).use([middleware.admin()])
}).prefix('/admin')

router.get("/", [FrontController, "index"]).as("front.index")
router.post("/contact", [FrontController, "submitContact"]).as("front.contact.submit")
router.get("/terms", async ({ view }) => view.render('front/terms')).as("front.terms")
router.get("/privacy", async ({ view }) => view.render('front/privacy')).as("front.privacy")
router.get("/about", async ({ view }) => view.render('front/about')).as("front.about")
router.get("/partners", async ({ view }) => view.render('front/partners')).as("front.partners")
router.post("/partners/submit", [PartnersController, "submit"]).as("front.partners.submit")
router.any("/not-found",async ({ view }) => view.render('front/404')).as("front.404")
