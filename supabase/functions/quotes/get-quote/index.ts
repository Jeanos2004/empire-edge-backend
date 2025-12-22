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

    // Parser les query params
    const url = new URL(req.url)
    const quoteId = url.searchParams.get('quote_id')
    const eventId = url.searchParams.get('event_id')

    if (!quoteId && !eventId) {
      throw new Error('quote_id ou event_id est requis')
    }

    // Construire la requête
    let query = supabaseClient
      .from('quotes')
      .select(`
        *,
        events(
          id,
          title,
          event_date,
          client_id,
          clients!inner(
            profile_id,
            profiles!inner(first_name, last_name, phone, email)
          )
        ),
        quote_items(
          id,
          event_service_id,
          description,
          quantity,
          unit_price,
          total_price,
          event_services(
            service_id,
            services(name, service_type)
          )
        ),
        contracts(id, contract_number, signed_at)
      `)

    if (quoteId) {
      query = query.eq('id', quoteId).single()
    } else {
      query = query.eq('event_id', eventId).order('created_at', { ascending: false })
    }

    const { data: quotes, error } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération du devis: ${error.message}`)
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (client) {
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes]
        const filteredQuotes = quotesArray.filter((quote: any) => {
          return quote.events?.client_id === client.profile_id
        })

        if (filteredQuotes.length === 0) {
          throw new Error('Devis introuvable ou accès non autorisé')
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: quoteId ? filteredQuotes[0] : filteredQuotes
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: quotes
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
        error: error.message || 'Erreur lors de la récupération du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

