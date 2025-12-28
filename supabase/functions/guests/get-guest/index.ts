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

    const url = new URL(req.url)
    const guestId = url.searchParams.get('guest_id')

    if (!guestId) {
      throw new Error('guest_id est requis')
    }

    // Récupérer l'invité
    const { data: guest, error: guestError } = await supabaseAdmin
      .from('guests')
      .select('*')
      .eq('id', guestId)
      .single()

    if (guestError || !guest) {
      throw new Error(`Invité introuvable: ${guestError?.message || 'Invité non trouvé'}`)
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

      // Vérifier que l'événement appartient au client
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('client_id')
        .eq('id', guest.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à cet invité')
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: guest }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération de l\'invité' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

