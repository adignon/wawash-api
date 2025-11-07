import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Partner from '#models/partner'

export default class PartnersController {
  // Submit partner application form
  async submit({ request, response, session }: HttpContext) {
    try {
      // Validate data
      const data = await vine.validate({
        schema: vine.object({
          full_name: vine.string().trim().minLength(2).maxLength(100),
          phone: vine.string().trim().minLength(8).maxLength(20),
          service_type: vine.enum(['launderer', 'pressing', 'delivery', 'other']),
          location: vine.string().trim().minLength(3).maxLength(255),
          experience: vine.string().trim().optional(),
          motivation: vine.string().trim().minLength(3).maxLength(1000)
        }),
        data: request.only(['full_name', 'phone', 'service_type', 'location', 'experience', 'motivation'])
      })

      // Create partner application
      await Partner.create({
        fullName: data.full_name,
        phone: data.phone,
        serviceType: data.service_type,
        location: data.location,
        experience: data.experience || null,
        motivation: data.motivation,
        status: 'pending'
      })

      session.flash('success', 'Votre candidature a été soumise avec succès. Nous vous contacterons bientôt.')
      return response.redirect().back()

    } catch (error) {
      console.error('Partner submission error:', error)
      if (error.messages) {
        session.flash('errors', error.messages)
      } else {
        session.flash('error', 'Une erreur est survenue. Veuillez réessayer.')
      }
      return response.redirect().back()
    }
  }

  // Admin: List all partner applications
  async index({ view, request }: HttpContext) {
    const page = request.input('page', 1)
    const status = request.input('status', '')

    let query = Partner.query().orderBy('created_at', 'desc')

    if (status && ['pending', 'approved', 'rejected', 'contacted'].includes(status)) {
      query = query.where('status', status)
    }

    const partners = await query.paginate(page, 20)

    return view.render('admin/partners/index', { partners, currentStatus: status })
  }

  // Admin: Show partner details
  async show({ view, params }: HttpContext) {
    const partner = await Partner.findOrFail(params.id)
    return view.render('admin/partners/show', { partner })
  }

  // Admin: Show edit form
  async edit({ view, params }: HttpContext) {
    const partner = await Partner.findOrFail(params.id)
    return view.render('admin/partners/edit', { partner })
  }

  // Admin: Update partner
  async update({ request, response, params, session }: HttpContext) {
    try {
      const partner = await Partner.findOrFail(params.id)

      const data = await vine.validate({
        schema: vine.object({
          status: vine.enum(['pending', 'approved', 'rejected', 'contacted']),
          admin_notes: vine.string().trim().optional()
        }),
        data: request.only(['status', 'admin_notes'])
      })

      partner.status = data.status
      partner.adminNotes = data.admin_notes || null
      await partner.save()

      session.flash('success', 'Candidature mise à jour avec succès.')
      return response.redirect().toRoute('admin.partners.show', { id: partner.id })

    } catch (error) {
      console.error('Partner update error:', error)
      session.flash('error', 'Une erreur est survenue lors de la mise à jour.')
      return response.redirect().back()
    }
  }

  // Admin: Delete partner application
  async destroy({ response, params, session }: HttpContext) {
    try {
      const partner = await Partner.findOrFail(params.id)
      await partner.delete()

      session.flash('success', 'Candidature supprimée avec succès.')
      return response.redirect().toRoute('admin.partners.index')

    } catch (error) {
      console.error('Partner deletion error:', error)
      session.flash('error', 'Une erreur est survenue lors de la suppression.')
      return response.redirect().back()
    }
  }
}
