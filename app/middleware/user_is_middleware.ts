import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class UserIsMiddleware {
  async handle(ctx: HttpContext, next: NextFn, role: "CLIENT" | "CLEANER" | "ADMIN") {
    /**
     * Middleware logic goes here (before the next call)
     */
    if (ctx.auth.user?.role == role) {
      const output = await next()
      return output
    } else {
      return ctx.response.status(403).json({
        message: "USER_PERMISSION_INVALID"
      })
    }

  }
}