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
    const eventId = url.searchParams.get('event_id')
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseClient
      .from('payments')
      .select(`
        *,
        events(id, title, event_date),
        quotes(quote_number, total_amount)
      `, { count: 'exact' })

    // Filtrer par événement ou client selon le rôle
    if (eventId) {
      query = query.eq('event_id', eventId)
    } else if (profile.role === 'client') {
      // Les clients voient seulement leurs paiements
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (client) {
        const { data: clientEvents } = await supabaseClient
          .from('events')
          .select('id')
          .eq('client_id', client.profile_id)

        if (clientEvents && clientEvents.length > 0) {
          const eventIds = clientEvents.map(e => e.id)
          query = query.in('event_id', eventIds)
        } else {
          // Pas d'événements, retourner vide
          return new Response(
            JSON.stringify({
              success: true,
              data: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
              }
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            },
          )
        }
      }
    }
    // Les admins voient tous les paiements

    // Appliquer les filtres
    if (status) {
      query = query.eq('status', status)
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: payments, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération de l'historique: ${error.message}`)
    }

    // Calculer les statistiques
    const stats = {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
    }

    payments?.forEach((payment) => {
      stats.total += payment.amount || 0
      if (payment.status === 'paid') {
        stats.paid += payment.amount || 0
      } else if (payment.status === 'pending') {
        stats.pending += payment.amount || 0
        if (payment.due_date && new Date(payment.due_date) < new Date()) {
          stats.overdue += payment.amount || 0
        }
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: payments || [],
        stats: stats,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
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
        error: error.message || 'Erreur lors de la récupération de l\'historique des paiements'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

