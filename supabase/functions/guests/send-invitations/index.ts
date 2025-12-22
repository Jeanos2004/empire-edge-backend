import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour générer un token unique
async function generateToken(): Promise<string> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Créer client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Vérifier authentification
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Non authentifié')
    }

    // Récupérer le profil
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    // Vérifier que l'événement existe
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, client_id, title, event_date')
      .eq('id', body.event_id)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || event.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Récupérer les invités
    let query = supabaseClient
      .from('guests')
      .select('id, first_name, last_name, email, phone')
      .eq('event_id', body.event_id)

    // Filtrer par guest_ids si fourni
    if (body.guest_ids && Array.isArray(body.guest_ids) && body.guest_ids.length > 0) {
      query = query.in('id', body.guest_ids)
    }

    const { data: guests, error: guestsError } = await query

    if (guestsError) {
      throw new Error(`Erreur lors de la récupération des invités: ${guestsError.message}`)
    }

    if (!guests || guests.length === 0) {
      throw new Error('Aucun invité trouvé')
    }

    // Créer les invitations
    const invitationsToInsert = []
    for (const guest of guests) {
      if (!guest.email && !guest.phone) {
        continue // Ignorer les invités sans contact
      }

      const token = await generateToken()
      const invitationType = guest.email ? 'email' : 'sms'

      invitationsToInsert.push({
        event_id: body.event_id,
        guest_id: guest.id,
        invitation_type: invitationType,
        sent_at: new Date().toISOString(),
        token: token,
      })
    }

    if (invitationsToInsert.length === 0) {
      throw new Error('Aucun invité avec email ou téléphone valide')
    }

    // Insérer les invitations
    const { data: invitations, error: insertError } = await supabaseClient
      .from('invitations')
      .insert(invitationsToInsert)
      .select()

    if (insertError) {
      throw new Error(`Erreur lors de la création des invitations: ${insertError.message}`)
    }

    // TODO: Envoyer les emails/SMS
    // Pour chaque invitation, envoyer un email ou SMS avec le lien RSVP
    // const rsvpUrl = `${baseUrl}/rsvp?token=${token}`
    // if (guest.email) {
    //   await sendEmail(guest.email, `Invitation: ${event.title}`, generateInvitationEmail(event, guest, rsvpUrl))
    // } else if (guest.phone) {
    //   await sendSMS(guest.phone, `Vous êtes invité à ${event.title}. Répondez: ${rsvpUrl}`)
    // }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invitations: invitations,
          sent_count: invitations.length,
        },
        message: `${invitations.length} invitation(s) envoyée(s) avec succès`
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
        error: error.message || 'Erreur lors de l\'envoi des invitations'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

