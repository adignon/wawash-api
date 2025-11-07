import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

export default class FrontsController {
  // Display home page with packages
  async index({ view }: HttpContext) {
    const Package = (await import('#models/package')).default

    // Fetch only subscribable packages ordered by amount (ascending)
    const packages = await Package.query()
      .where('isSubscriptable', true)
      .orderBy('amount', 'asc')

    // Find the most expensive package (featured/recommended)
    const mostExpensivePackage = packages.length > 0 ? packages[packages.length - 1] : null

    // Get the 3 packages for display (ordered by price)
    const famillePackage = packages[2] || null  // Most expensive
    const essentialPackage = packages[1] || null  // Middle price
    const premiumPackage = packages[0] || null  // Lowest price
    console.log(famillePackage)
    return view.render('front/index', {
      packages,
      famillePackage,
      essentialPackage,
      premiumPackage,
      mostExpensivePackage
    })
  }

  // Submit contact form
  async submitContact({ request, response, session }: HttpContext) {
    const Contact = (await import('#models/contact')).default
    const User = (await import('#models/user')).default


    try {
      // Validate data
      const data = await vine.validate({
        schema: vine.object({
        name: vine.string().trim().minLength(2).maxLength(100),
        email: vine.string().trim().email(),
        message: vine.string().trim().minLength(3).maxLength(1000)
      }),
        data: request.only(['name', 'email', 'message'])
      })

      // Save contact to database
      const contact = await Contact.create({
        name: data.name,
        email: data.email,
        message: data.message,
        isRead: false
      })

      // Get all admin users for notification
      const admins = await User.query().where('role', 'ADMIN')

      // Log notification (email can be configured later)
      console.log('📧 New contact received:')
      console.log(`   From: ${contact.name} (${contact.email})`)
      console.log(`   Message: ${contact.message.substring(0, 100)}...`)
      console.log(`   Admins to notify: ${admins.map(a => a.email).join(', ')}`)

      // TODO: Send email to all admins when mail is configured
      // This requires configuring @adonisjs/mail with SMTP credentials

      session.flash('success', 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.')
      return response.redirect().back()

    } catch (error) {
      console.log(error)
      if (error.messages) {
        session.flash('error', error.messages[0].message)
      } else {
        session.flash('error', 'Une erreur est survenue. Veuillez réessayer.')
      }
      return response.redirect().back()
    }
  }
}