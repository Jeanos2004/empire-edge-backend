import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Non authentifié')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    const body = await req.json()

    if (!body.guest_id) {
      throw new Error('guest_id est requis')
    }

    // Vérifier que l'invité existe
    const { data: existingGuest } = await supabaseAdmin
      .from('guests')
      .select('event_id')
      .eq('id', body.guest_id)
      .single()

    if (!existingGuest) {
      throw new Error('Invité introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable')
      }

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('client_id')
        .eq('id', existingGuest.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à cet invité')
      }
    }

    const updates: any = {}
    if (body.first_name !== undefined) updates.first_name = body.first_name
    if (body.last_name !== undefined) updates.last_name = body.last_name
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.category !== undefined) updates.category = body.category
    if (body.rsvp_status !== undefined) updates.rsvp_status = body.rsvp_status
    if (body.dietary_restrictions !== undefined) updates.dietary_restrictions = body.dietary_restrictions
    if (body.plus_one !== undefined) updates.plus_one = body.plus_one
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.badge_generated !== undefined) updates.badge_generated = body.badge_generated

    const { data: guest, error } = await supabaseAdmin
      .from('guests')
      .update(updates)
      .eq('id', body.guest_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'invité: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: guest, message: 'Invité mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour de l\'invité' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

