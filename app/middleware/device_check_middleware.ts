import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import type { NextFn } from '@adonisjs/core/types/http'

export default class DeviceCheckMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { authicationCheck: boolean }) {
    /**
     * Middleware logic goes here (before the next call)
     */
    try {
      if (!ctx.request.header("x-device-id")) {
        logger.error("[ACTIVITE SUSPECTE]: L'utilisateur n'a pas envoyé Id du device, il est possible qu'il appelle directement l'API")
        return ctx.response.status(400).json({
          message: ctx.i18n.t("Requete incorrecte")
        })
      }
      const user = options.authicationCheck ? ctx.auth.getUserOrFail() : null
      if (!user || user.lastDevice == ctx.request.header("x-device-id")) {
        const output = await next()
        return output
      }

    } catch (e) {
      console.log(e)
    }
    return ctx.response.status(403).json({
        message: "DEVICE_ERROR_DISCONNECT"
      })
  }
}