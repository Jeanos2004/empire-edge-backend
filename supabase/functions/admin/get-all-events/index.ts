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

    // Seuls les admins peuvent accéder à tous les événements
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser les query params
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const eventType = url.searchParams.get('event_type')
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const clientId = url.searchParams.get('client_id')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseClient
      .from('events')
      .select(`
        *,
        clients!inner(
          profile_id,
          profiles!inner(first_name, last_name, phone, email)
        ),
        venues(name, address, city),
        quotes(id, quote_number, total_amount, status)
      `, { count: 'exact' })

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

    if (clientId) {
      query = query.eq('client_id', clientId)
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

