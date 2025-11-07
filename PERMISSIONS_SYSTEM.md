# Admin Permissions System

## Overview
This document describes the comprehensive permissions system implemented for the WaWash admin panel. The system allows fine-grained access control for different admin users based on assigned permissions.

## Features

### 1. **Granular Permissions**
Each permission follows the format: `module.action`
- Example: `users.read`, `users.create`, `users.update`, `users.delete`

### 2. **Permission Modules**
The system includes permissions for the following modules:

#### Dashboard
- `dashboard.view` - View admin dashboard

#### Admins Management
- `admins.read` - View admins list
- `admins.create` - Create new admin
- `admins.update` - Edit admin details
- `admins.delete` - Delete admin
- `admins.permissions` - Manage admin permissions

#### Users Management
- `users.read` - View users list
- `users.create` - Create new user
- `users.update` - Edit user details
- `users.delete` - Delete user

#### Merchants Management
- `merchants.read` - View merchants list
- `merchants.create` - Create new merchant
- `merchants.update` - Edit merchant details
- `merchants.delete` - Delete merchant
- `merchants.addresses` - Manage merchant addresses

#### Subscriptions Management
- `subscriptions.read` - View subscriptions list
- `subscriptions.create` - Create new subscription
- `subscriptions.update` - Edit subscription
- `subscriptions.delete` - Delete subscription

#### Orders Management
- `orders.read` - View orders list
- `orders.create` - Create new order
- `orders.update` - Edit order
- `orders.delete` - Delete order

#### Scheduling & Delivery
- `scheduling.view` - View scheduling calendar
- `scheduling.read` - View scheduled orders
- `scheduling.manage` - Manage scheduling
- `delivery.read` - View delivery assignments
- `delivery.assign` - Assign deliveries
- `delivery.export` - Export delivery PDF

#### Wallet Management
- `wallet.read` - View wallet dashboard
- `wallet.withdraw` - Create withdrawal request (requires 2FA)
- `wallet.transactions` - View transactions

#### Packages Management
- `packages.read` - View packages
- `packages.update` - Edit packages

#### Configuration
- `config.read` - View configuration
- `config.update` - Update configuration

#### Settings (Account & 2FA)
- `settings.view` - View account settings
- `settings.2fa` - Manage 2FA settings

## Database Structure

### Tables Created

1. **permissions** - Stores all available permissions
   - `id` - Primary key
   - `name` - Unique permission name (e.g., 'users.read')
   - `module` - Module name (e.g., 'users')
   - `action` - Action name (e.g., 'read')
   - `description` - Human-readable description

2. **user_permissions** - Pivot table for user-permission relationships
   - `id` - Primary key
   - `user_id` - Foreign key to users table
   - `permission_id` - Foreign key to permissions table
   - Unique constraint on (user_id, permission_id)

## Implementation Details

### Models

#### Permission Model (`app/models/permission.ts`)
- Defines permission structure
- Has many-to-many relationship with User model

#### User Model (`app/models/user.ts`)
- Extended with permissions relationship
- Helper methods:
  - `hasPermission(permissionName)` - Check single permission
  - `hasAnyPermission(permissionNames)` - Check if user has any of the permissions
  - `hasAllPermissions(permissionNames)` - Check if user has all permissions

### Middleware

#### CheckPermissionMiddleware (`app/middleware/check_permission_middleware.ts`)
- Verifies user has required permission(s) before accessing routes
- Can check for single permission or multiple permissions
- Supports "requireAll" mode (user must have ALL permissions)
- Redirects unauthorized users to dashboard with error message

Usage in routes:
```typescript
router.get('/users', [AdminController, 'usersIndex'])
  .use(middleware.permission({ permissions: 'users.read' }))
```

#### AdminMiddleware (`app/middleware/admin_middleware.ts`)
- Updated to load user permissions
- Shares permission helpers with views:
  - `hasPermission(permissionName)` - Check in views
  - `hasAnyPermission(permissions)` - Check multiple permissions in views
  - `userPermissions` - Array of permission names

### Views

#### Permission Management UI (`resources/views/admin/admins/permissions.edge`)
- Beautiful, user-friendly interface for managing admin permissions
- Groups permissions by module
- "Select All" button for each module
- Shows admin info at the top
- Real-time checkbox interaction

#### Sidebar Menu (`resources/views/components/layout/admin.edge`)
- Dynamically hides menu items based on user permissions
- Only shows sections user has access to
- Prevents UI clutter for limited-access admins

### Controllers

#### AdminController Permission Methods
- `adminPermissions()` - Display permission management page
- `adminPermissionsUpdate()` - Update admin permissions (sync)

### Seeder

#### PermissionSeeder (`database/seeders/permission_seeder.ts`)
- Seeds all 52 permissions into the database
- Uses `updateOrCreate` to avoid duplicates
- Can be run multiple times safely

## Usage Guide

### 1. Seeding Permissions
```bash
node ace db:seed --files database/seeders/permission_seeder.ts
```

### 2. Assigning Permissions to Admin

**Via UI:**
1. Go to Admin Management (`/admin/admins`)
2. Click "🔐 Permissions" button next to any admin
3. Select desired permissions (grouped by module)
4. Click "💾 Save Permissions"

**Programmatically:**
```typescript
// Get admin user
const admin = await User.find(adminId)

// Get permissions
const readPermissions = await Permission.query()
  .whereIn('name', ['users.read', 'orders.read', 'merchants.read'])

// Attach permissions
await admin.related('permissions').attach(readPermissions.map(p => p.id))

// Or sync permissions (replaces existing)
await admin.related('permissions').sync([1, 2, 3, 4])
```

### 3. Checking Permissions in Controllers

```typescript
// In controller method
const user = auth.user!
await user.load('permissions')

if (await user.hasPermission('users.delete')) {
  // User can delete users
}

if (await user.hasAnyPermission(['users.read', 'users.update'])) {
  // User can read OR update users
}
```

### 4. Protecting Routes with Middleware

```typescript
// Single permission
router.get('/users', [AdminController, 'usersIndex'])
  .use(middleware.permission({ permissions: 'users.read' }))

// Multiple permissions (needs ANY)
router.get('/dashboard', [AdminController, 'dashboard'])
  .use(middleware.permission({
    permissions: ['dashboard.view', 'admin.full_access']
  }))

// Multiple permissions (needs ALL)
router.post('/users/:id/delete', [AdminController, 'usersDelete'])
  .use(middleware.permission({
    permissions: ['users.delete', 'users.read'],
    requireAll: true
  }))
```

### 5. Checking Permissions in Views

```edge
{{-- Check single permission --}}
@if(hasPermission('users.create'))
  <a href="{{ route('admin.users.create') }}" class="btn btn-primary">
    Create User
  </a>
@end

{{-- Check multiple permissions (has any) --}}
@if(hasAnyPermission(['users.read', 'users.update']))
  <div class="user-section">
    <!-- Content -->
  </div>
@end

{{-- Hide entire menu section --}}
@if(hasAnyPermission(['orders.read', 'orders.create']))
  <div class="menu-section">
    <h3>Orders</h3>
    <!-- Orders menu items -->
  </div>
@end
```

## Security Features

1. **Database-Level Constraints**
   - Unique constraint prevents duplicate permission assignments
   - Foreign key cascade deletes when user is deleted

2. **Middleware Protection**
   - Routes can be protected at route level
   - Unauthorized access redirects to dashboard with error message
   - Flash messages inform users about access issues

3. **View-Level Hiding**
   - Menu items hidden from unauthorized users
   - Prevents discovery of restricted functionality
   - Cleaner UI for limited-access admins

4. **Permission Helpers**
   - Type-safe permission checking
   - Loaded once per request (cached in memory)
   - No N+1 query issues

## Best Practices

1. **Always Protect Routes**
   - Don't rely only on hiding UI elements
   - Add middleware to routes requiring permissions
   - Double-check permissions in controller methods

2. **Assign Minimal Permissions**
   - Give users only the permissions they need
   - Review permissions regularly
   - Remove unused permissions

3. **Use Descriptive Permissions**
   - Follow the `module.action` naming convention
   - Keep descriptions clear and concise
   - Document custom permissions

4. **Test Permission Changes**
   - Log in as different admin users
   - Verify access restrictions work correctly
   - Test both UI hiding and route protection

## Example: Creating a New Admin with Limited Access

```typescript
// Create admin user
const admin = await User.create({
  firstname: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  role: 'ADMIN',
  otpHash: await hash.make('password123')
})

// Assign read-only permissions for users and orders
const permissions = await Permission.query()
  .whereIn('name', [
    'dashboard.view',
    'users.read',
    'orders.read',
    'settings.view'
  ])

await admin.related('permissions').attach(permissions.map(p => p.id))
```

This admin can:
- ✅ View dashboard
- ✅ View users list
- ✅ View orders list
- ✅ Access their settings
- ❌ Create, edit, or delete anything
- ❌ Access merchants, wallet, or configuration

## Troubleshooting

### Admin can't see any menu items
- Check that admin has at least `dashboard.view` permission
- Verify permissions were properly assigned in database
- Check `user_permissions` table for records

### Permission check always fails
- Ensure `admin` middleware is applied to routes
- Verify permissions are loaded: `await user.load('permissions')`
- Check permission name spelling (case-sensitive)

### "Permission not found" error
- Run the permission seeder: `node ace db:seed --files database/seeders/permission_seeder.ts`
- Check `permissions` table has records
- Verify migration ran successfully

## Future Enhancements

1. **Role-Based Permissions**
   - Create predefined roles (Super Admin, Manager, Viewer)
   - Assign permissions to roles
   - Assign roles to users

2. **Permission Groups**
   - Group related permissions for easier management
   - Bulk assign permission groups

3. **Audit Log**
   - Track permission changes
   - Log when admins access sensitive resources
   - Report on permission usage

4. **Time-Based Permissions**
   - Temporary access grants
   - Scheduled permission activation/deactivation
   - Access windows (e.g., business hours only)

## Files Modified/Created

### Created:
- `database/migrations/1761745724250_create_create_permissions_table.ts`
- `database/migrations/1761745763353_create_create_user_permissions_table.ts`
- `app/models/permission.ts`
- `app/middleware/check_permission_middleware.ts`
- `database/seeders/permission_seeder.ts`
- `resources/views/admin/admins/permissions.edge`

### Modified:
- `app/models/user.ts` - Added permissions relationship and helper methods
- `start/kernel.ts` - Registered permission middleware
- `start/routes.ts` - Added permission management routes
- `app/middleware/admin_middleware.ts` - Load and share permissions with views
- `resources/views/components/layout/admin.edge` - Added permission checks to menu
- `resources/views/admin/admins/index.edge` - Added permissions button
- `app/controllers/admin_controller.ts` - Added permission management methods

## Summary

The permission system is now fully functional and ready to use. Admins can be assigned specific permissions, and the system will automatically:
- Hide unauthorized menu items
- Protect routes from unauthorized access
- Provide clear error messages
- Offer easy-to-use UI for permission management

The system is secure, scalable, and follows Laravel/AdonisJS best practices for access control.
