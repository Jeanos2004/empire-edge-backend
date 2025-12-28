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
    const eventId = url.searchParams.get('event_id')
    const quoteId = url.searchParams.get('quote_id')
    const contractId = url.searchParams.get('contract_id')
    const documentType = url.searchParams.get('document_type')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    if (quoteId) {
      query = query.eq('quote_id', quoteId)
    }

    if (contractId) {
      query = query.eq('contract_id', contractId)
    }

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    // Vérifier les permissions pour les clients
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable')
      }

      // Si event_id est fourni, vérifier qu'il appartient au client
      if (eventId) {
        const { data: event } = await supabaseAdmin
          .from('events')
          .select('client_id')
          .eq('id', eventId)
          .single()

        if (!event || event.client_id !== client.id) {
          throw new Error('Accès non autorisé à cet événement')
        }
      } else {
        // Sinon, filtrer uniquement les documents des événements du client
        const { data: clientEvents } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('client_id', client.id)

        if (clientEvents && clientEvents.length > 0) {
          const eventIds = clientEvents.map(e => e.id)
          query = query.in('event_id', eventIds)
        } else {
          return new Response(
            JSON.stringify({
              success: true,
              data: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
      }
    }

    query = query.order('created_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data: documents, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des documents: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: documents || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération des documents' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

