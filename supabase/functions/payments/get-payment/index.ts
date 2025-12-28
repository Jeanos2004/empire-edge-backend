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
    const paymentId = url.searchParams.get('payment_id')

    if (!paymentId) {
      throw new Error('payment_id est requis')
    }

    // Récupérer le paiement
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        events(id, title, event_date),
        quotes(id, quote_number)
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      throw new Error(`Paiement introuvable: ${paymentError?.message || 'Paiement non trouvé'}`)
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
        .eq('id', payment.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à ce paiement')
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: payment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du paiement' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

