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
    // Créer client Supabase avec service role pour contourner RLS
    // Cette fonction est publique (pas d'authentification requise)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    // Normaliser le statut RSVP (accepter les variantes)
    const statusMap: Record<string, string> = {
      'accepted': 'accepted',
      'accepte': 'accepted',
      'accept': 'accepted',
      'declined': 'declined',
      'refused': 'declined',
      'refuse': 'declined',
      'maybe': 'maybe',
      'peut-etre': 'maybe',
      'pending': 'pending',
    }
    
    const normalizedStatus = statusMap[rsvpStatus.toLowerCase()] || rsvpStatus.toLowerCase()
    
    // Les statuts valides sont: accepted, declined, maybe, pending
    const validStatuses = ['accepted', 'declined', 'maybe', 'pending']
    if (!validStatuses.includes(normalizedStatus)) {
      throw new Error(`rsvp_status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`)
    }
    
    // Utiliser le statut normalisé
    rsvpStatus = normalizedStatus

    let guest: any = null

    // Si token fourni, trouver l'invitation (utiliser supabaseAdmin pour éviter RLS)
    if (token) {
      const { data: invitation, error: invitationError } = await supabaseAdmin
        .from('invitations')
        .select(`
          *,
          guests(*)
        `)
        .eq('token', token)
        .single()

      if (invitationError || !invitation) {
        throw new Error(`Invitation introuvable ou token invalide: ${invitationError?.message || 'Aucune invitation trouvée avec ce token'}`)
      }

      if (!invitation.guests) {
        throw new Error('Invité associé à l\'invitation introuvable')
      }

      guest = invitation.guests
      guestId = guest.id
    } else if (guestId) {
      // Si guest_id fourni, récupérer l'invité (utiliser supabaseAdmin)
      const { data: guestData, error: guestError } = await supabaseAdmin
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single()

      if (guestError || !guestData) {
        throw new Error(`Invité introuvable: ${guestError?.message || 'Invité non trouvé'}`)
      }

      guest = guestData
    }

    if (!guest) {
      throw new Error('Impossible de trouver l\'invité')
    }

    // Mettre à jour le statut RSVP (utiliser supabaseAdmin)
    const { data: updatedGuest, error: updateError } = await supabaseAdmin
      .from('guests')
      .update({
        rsvp_status: rsvpStatus,
        rsvp_date: new Date().toISOString(),
      })
      .eq('id', guestId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour du RSVP: ${updateError.message}`)
    }

    // Mettre à jour l'invitation si un token était fourni
    if (token) {
      await supabaseAdmin
        .from('invitations')
        .update({
          opened_at: new Date().toISOString(),
        })
        .eq('token', token)
    }

    // Récupérer les détails de l'événement pour la réponse (utiliser supabaseAdmin)
    const { data: event } = await supabaseAdmin
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

