import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Check if user is authenticated with web guard
    await ctx.auth.use('web').check()
    if (!ctx.auth.use('web').isAuthenticated) {
      ctx.session.flash('error', 'Please login to continue')
      return ctx.response.redirect().toRoute('admin.login')
    }

    const user = ctx.auth.use('web').user

    // Check if user has admin role
    if (!user || user.role !== 'ADMIN') {
      ctx.session.flash('error', 'Access denied. Admin privileges required.')
      return ctx.response.redirect().toRoute('admin.login')
    }

    // Load user permissions
    await user.load('permissions')

    // Create a helper function to check permissions in views
    const userPermissions = user.permissions.map(p => p.name)
    const hasPermission = (permissionName: string) => userPermissions.includes(permissionName)
    const hasAnyPermission = (permissions: string[]) => permissions.some(p => userPermissions.includes(p))

    // Share user and permission helpers with views
    ctx.view.share({
      auth: { user },
      userPermissions,
      hasPermission,
      hasAnyPermission
    })

    const output = await next()
    return output
  }
}
