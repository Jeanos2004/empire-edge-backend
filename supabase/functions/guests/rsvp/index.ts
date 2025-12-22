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
    // Créer client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parser le body ou query params
    let token: string | null = null
    let guestId: string | null = null
    let rsvpStatus: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      token = body.token
      guestId = body.guest_id
      rsvpStatus = body.rsvp_status
    } else {
      const url = new URL(req.url)
      token = url.searchParams.get('token')
      guestId = url.searchParams.get('guest_id')
      rsvpStatus = url.searchParams.get('rsvp_status')
    }

    // Validation
    if (!token && !guestId) {
      throw new Error('token ou guest_id est requis')
    }

    if (!rsvpStatus) {
      throw new Error('rsvp_status est requis')
    }

    const validStatuses = ['accepted', 'declined', 'maybe']
    if (!validStatuses.includes(rsvpStatus)) {
      throw new Error(`rsvp_status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`)
    }

    let guest: any = null

    // Si token fourni, trouver l'invitation
    if (token) {
      const { data: invitation, error: invitationError } = await supabaseClient
        .from('invitations')
        .select(`
          *,
          guests(*)
        `)
        .eq('token', token)
        .single()

      if (invitationError || !invitation) {
        throw new Error('Invitation introuvable ou token invalide')
      }

      guest = invitation.guests
      guestId = guest.id
    } else if (guestId) {
      // Si guest_id fourni, récupérer l'invité
      const { data: guestData, error: guestError } = await supabaseClient
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single()

      if (guestError || !guestData) {
        throw new Error('Invité introuvable')
      }

      guest = guestData
    }

    if (!guest) {
      throw new Error('Impossible de trouver l\'invité')
    }

    // Mettre à jour le statut RSVP
    const { data: updatedGuest, error: updateError } = await supabaseClient
      .from('guests')
      .update({
        rsvp_status: rsvpStatus,
        rsvp_updated_at: new Date().toISOString(),
      })
      .eq('id', guestId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour du RSVP: ${updateError.message}`)
    }

    // Récupérer les détails de l'événement pour la réponse
    const { data: event } = await supabaseClient
      .from('events')
      .select('id, title, event_date')
      .eq('id', guest.event_id)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          guest: updatedGuest,
          event: event,
        },
        message: `RSVP mis à jour: ${rsvpStatus}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de la mise à jour du RSVP'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

