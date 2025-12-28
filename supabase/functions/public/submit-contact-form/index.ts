import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Créer client Supabase avec service role pour éviter les problèmes RLS
    // Cette fonction est publique mais doit contourner RLS pour insérer dans notifications
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parser le body
    const body = await req.json()

    // Validation
    if (!body.name) {
      throw new Error('Le nom est requis')
    }

    if (!body.email) {
      throw new Error('L\'email est requis')
    }

    if (!body.message) {
      throw new Error('Le message est requis')
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      throw new Error('Format email invalide')
    }

    // Récupérer le premier admin pour créer la notification
    // Note: On crée une notification pour le premier admin trouvé (ou null pour notification globale)
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])
      .limit(1)
      .single()

    // Créer une notification pour les admins (utiliser supabaseAdmin pour éviter RLS)
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: adminProfile?.id || null, // Notification pour un admin ou globale
        event_id: null,
        type: 'contact_form',
        title: `Nouveau message de contact de ${body.name}`,
        message: `Email: ${body.email}\nSujet: ${body.subject || 'Non spécifié'}\nTéléphone: ${body.phone || 'Non fourni'}\n\nMessage:\n${body.message}`,
        is_read: false,
      })
      .select()
      .single()

    if (notificationError) {
      throw new Error(`Erreur lors de l'envoi du formulaire: ${notificationError.message}`)
    }

    // TODO: Envoyer un email de confirmation au client
    // await sendEmail(body.email, 'Merci pour votre message', generateContactConfirmationEmail(body.name))

    // TODO: Envoyer un email aux admins
    // const adminEmails = await getAdminEmails()
    // await sendEmail(adminEmails, `Nouveau message de contact`, generateContactAdminEmail(body))

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          notification_id: notification.id,
        },
        message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de l\'envoi du formulaire de contact'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

