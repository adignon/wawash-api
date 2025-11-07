import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * CheckPermission middleware is used to verify that the authenticated user
 * has the required permission(s) to access a route
 */
export default class CheckPermissionMiddleware {
  /**
   * Handle the request and check for permissions
   * @param permissions - Single permission or array of permissions required
   * @param requireAll - If true, user must have ALL permissions. If false, user needs ANY permission
   */
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { permissions: string | string[]; requireAll?: boolean }
  ) {
    const { auth, response, session } = ctx
    const { permissions, requireAll = false } = options

    // Get authenticated user
    const user = auth.use("web").user
    if (!user) {
      session.flash('error', 'Please login to continue')
      return response.redirect().toRoute('admin.login')
    }

    // Load user permissions if not already loaded
    await user.load((preloader) => {
      preloader.load('permissions')
    })

    // Convert single permission to array for easier handling
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions]

    // Check if user has required permissions
    const userPermissionNames = user.permissions.map((p) => p.name)

    let hasAccess = false

    if (requireAll) {
      // User must have ALL required permissions
      hasAccess = requiredPermissions.every((perm) => userPermissionNames.includes(perm))
    } else {
      // User needs at least ONE of the required permissions
      hasAccess = requiredPermissions.some((perm) => userPermissionNames.includes(perm))
    }

    if (!hasAccess) {
      // Redirect to no-permissions page instead of dashboard
      return response.redirect().toRoute('admin.no-permissions')
    }

    // User has permission, continue to the route handler
    await next()
  }
}
