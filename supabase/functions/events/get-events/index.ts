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

    // Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer le profil pour déterminer les permissions
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Parser les query params
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const eventType = url.searchParams.get('event_type')
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Utiliser supabaseAdmin pour éviter les problèmes RLS avec les profils
    // Construire la requête
    let query = supabaseAdmin
      .from('events')
      .select(`
        *,
        venues(name, address, city),
        quotes(id, quote_number, total_amount, status),
        clients!inner(
          profile_id,
          profiles!inner(first_name, last_name, phone)
        )
      `, { count: 'exact' })

    // Si c'est un client, filtrer par ses événements uniquement
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (client) {
        query = query.eq('client_id', client.id)
      }
    }
    // Les admins voient tous les événements

    // Appliquer les filtres
    if (status) {
      query = query.eq('status', status)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (startDate) {
      query = query.gte('event_date', startDate)
    }

    if (endDate) {
      query = query.lte('event_date', endDate)
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: events, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des événements: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: events || [],
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
        error: error.message || 'Erreur lors de la récupération des événements'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

