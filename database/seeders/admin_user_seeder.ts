import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Permission from '#models/permission'
import hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    await this.permissions()
    // Create default admin user
    // This will only create the admin if the email doesn't already exist
    const admin = await User.updateOrCreate(
      { email: 'admin@WaWash.com' },
      {
        firstname: 'Admin',
        lastname: 'WaWash',
        email: 'admin@WaWash.com',
        phone: '+22901000000',
        role: 'ADMIN',
        otpHash: await hash.make('admin123'), // Default password: admin123
        imageUrl: 'https://ui-avatars.com/api/?name=Admin+WaWash&background=667eea&color=ffffff',
      }
    )

    // Grant all permissions to the first admin
    const allPermissions = await Permission.all()

    if (allPermissions.length > 0) {
      // Get current permission IDs
      await admin.load('permissions')
      const currentPermissionIds = admin.permissions.map(p => p.id)

      // Get all permission IDs
      const allPermissionIds = allPermissions.map(p => p.id)

      // Find new permissions to attach (avoid duplicates)
      const newPermissionIds = allPermissionIds.filter(id => !currentPermissionIds.includes(id))

      if (newPermissionIds.length > 0) {
        await admin.related('permissions').attach(newPermissionIds)
        console.log(`✅ Granted ${newPermissionIds.length} new permissions to admin user`)
      } else {
        console.log('✅ Admin already has all permissions')
      }
    }

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email: admin@WaWash.com')
    console.log('🔑 Password: admin123')
    console.log(`🔐 Total Permissions: ${allPermissions.length}`)
    console.log('⚠️  Please change this password after first login!')
  }

  async permissions() {
      const permissions = [
        // Dashboard
        { name: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View admin dashboard' },
  
        // Admins Management
        { name: 'admins.read', module: 'admins', action: 'read', description: 'View admins list' },
        { name: 'admins.create', module: 'admins', action: 'create', description: 'Create new admin' },
        { name: 'admins.update', module: 'admins', action: 'update', description: 'Edit admin details' },
        { name: 'admins.delete', module: 'admins', action: 'delete', description: 'Delete admin' },
        { name: 'admins.permissions', module: 'admins', action: 'permissions', description: 'Manage admin permissions' },
  
        // Users Management
        { name: 'users.read', module: 'users', action: 'read', description: 'View users list' },
        { name: 'users.create', module: 'users', action: 'create', description: 'Create new user' },
        { name: 'users.update', module: 'users', action: 'update', description: 'Edit user details' },
        { name: 'users.delete', module: 'users', action: 'delete', description: 'Delete user' },
  
        // Merchants Management
        { name: 'merchants.read', module: 'merchants', action: 'read', description: 'View merchants list' },
        { name: 'merchants.create', module: 'merchants', action: 'create', description: 'Create new merchant' },
        { name: 'merchants.update', module: 'merchants', action: 'update', description: 'Edit merchant details' },
        { name: 'merchants.delete', module: 'merchants', action: 'delete', description: 'Delete merchant' },
        { name: 'merchants.addresses', module: 'merchants', action: 'addresses', description: 'Manage merchant addresses' },
  
        // Subscriptions Management
        { name: 'subscriptions.read', module: 'subscriptions', action: 'read', description: 'View subscriptions list' },
        { name: 'subscriptions.create', module: 'subscriptions', action: 'create', description: 'Create new subscription' },
        { name: 'subscriptions.update', module: 'subscriptions', action: 'update', description: 'Edit subscription' },
        { name: 'subscriptions.delete', module: 'subscriptions', action: 'delete', description: 'Delete subscription' },
  
        // Orders Management
        { name: 'orders.read', module: 'orders', action: 'read', description: 'View orders list' },
        { name: 'orders.create', module: 'orders', action: 'create', description: 'Create new order' },
        { name: 'orders.update', module: 'orders', action: 'update', description: 'Edit order' },
        { name: 'orders.delete', module: 'orders', action: 'delete', description: 'Delete order' },
  
        // Scheduling & Delivery
        { name: 'scheduling.view', module: 'scheduling', action: 'view', description: 'View scheduling calendar' },
        { name: 'scheduling.read', module: 'scheduling', action: 'read', description: 'View scheduled orders' },
        { name: 'scheduling.manage', module: 'scheduling', action: 'manage', description: 'Manage scheduling' },
        { name: 'delivery.read', module: 'delivery', action: 'read', description: 'View delivery assignments' },
        { name: 'delivery.assign', module: 'delivery', action: 'assign', description: 'Assign deliveries' },
        { name: 'delivery.export', module: 'delivery', action: 'export', description: 'Export delivery PDF' },
  
        // Wallet Management
        { name: 'wallet.read', module: 'wallet', action: 'read', description: 'View wallet dashboard' },
        { name: 'wallet.withdraw', module: 'wallet', action: 'withdraw', description: 'Create withdrawal request' },
        { name: 'wallet.transactions', module: 'wallet', action: 'transactions', description: 'View transactions' },
  
        // Packages Management
        { name: 'packages.read', module: 'packages', action: 'read', description: 'View packages' },
        { name: 'packages.update', module: 'packages', action: 'update', description: 'Edit packages' },
  
        // Configuration
        { name: 'config.read', module: 'config', action: 'read', description: 'View configuration' },
        { name: 'config.update', module: 'config', action: 'update', description: 'Update configuration' },
  
        // Settings (Account & 2FA) - Everyone should have access to their own settings
        { name: 'settings.view', module: 'settings', action: 'view', description: 'View account settings' },
        { name: 'settings.2fa', module: 'settings', action: '2fa', description: 'Manage 2FA settings' },
  
        // Contact
        {
          name: 'contacts.read',
          description: 'View contact messages',
          module: 'contacts',
          action: 'read'
        },
        {
          name: 'contacts.update',
          description: 'Update contact messages (mark as read/unread)',
          module: 'contacts',
          action: 'update'
        },
        {
          name: 'contacts.delete',
          description: 'Delete contact messages',
          module: 'contacts',
          action: 'delete'
        },
  
        // Partners Management
        {
          name: 'partners.read',
          description: 'View partner applications',
          module: 'partners',
          action: 'read'
        },
        {
          name: 'partners.update',
          description: 'Update partner application status',
          module: 'partners',
          action: 'update'
        },
        {
          name: 'partners.delete',
          description: 'Delete partner applications',
          module: 'partners',
          action: 'delete'
        }
      ]
  
      // Use updateOrCreate to avoid duplicate entries
      for (const permission of permissions) {
        await Permission.updateOrCreate(
          { name: permission.name },
          permission
        )
      }
    }
}
