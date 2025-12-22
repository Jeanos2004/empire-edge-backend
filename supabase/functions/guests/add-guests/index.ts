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

    if (!body.guests || !Array.isArray(body.guests) || body.guests.length === 0) {
      throw new Error('Au moins un invité est requis')
    }

    // Vérifier que l'événement existe
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, client_id, guest_count')
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

    // Valider et préparer les invités
    const guestsToInsert = []
    for (const guest of body.guests) {
      if (!guest.first_name || !guest.last_name) {
        throw new Error('Chaque invité doit avoir un prénom et un nom')
      }

      if (!guest.email && !guest.phone) {
        throw new Error('Chaque invité doit avoir au moins un email ou un numéro de téléphone')
      }

      guestsToInsert.push({
        event_id: body.event_id,
        first_name: guest.first_name,
        last_name: guest.last_name,
        email: guest.email || null,
        phone: guest.phone || null,
        rsvp_status: 'pending',
        dietary_restrictions: guest.dietary_restrictions || null,
        category: guest.category || 'guest',
      })
    }

    // Insérer les invités
    const { data: insertedGuests, error: insertError } = await supabaseClient
      .from('guests')
      .insert(guestsToInsert)
      .select()

    if (insertError) {
      throw new Error(`Erreur lors de l'ajout des invités: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: insertedGuests,
        message: `${insertedGuests.length} invité(s) ajouté(s) avec succès`
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
        error: error.message || 'Erreur lors de l\'ajout des invités'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

