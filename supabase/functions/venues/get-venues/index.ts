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
    // Utiliser supabaseAdmin pour éviter les problèmes RLS
    // Cette fonction est publique (lieux disponibles visibles par tous)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parser les query params
    const url = new URL(req.url)
    const city = url.searchParams.get('city')
    const minCapacity = url.searchParams.get('min_capacity')
    const maxCapacity = url.searchParams.get('max_capacity')
    const date = url.searchParams.get('date')
    const isAvailable = url.searchParams.get('is_available')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseAdmin
      .from('venues')
      .select('*', { count: 'exact' })

    // Appliquer les filtres
    if (city) {
      query = query.eq('city', city)
    }

    if (minCapacity) {
      query = query.gte('capacity_max', parseInt(minCapacity))
    }

    if (maxCapacity) {
      query = query.lte('capacity_max', parseInt(maxCapacity))
    }

    if (isAvailable !== null) {
      query = query.eq('is_available', isAvailable === 'true')
    } else {
      // Par défaut, ne montrer que les lieux disponibles
      query = query.eq('is_available', true)
    }

    // Filtrer par disponibilité pour une date spécifique
    if (date) {
      const { data: unavailableVenues } = await supabaseAdmin
        .from('venue_availability')
        .select('venue_id')
        .eq('date', date.split('T')[0])
        .eq('is_available', false)

      if (unavailableVenues && unavailableVenues.length > 0) {
        const unavailableIds = unavailableVenues.map(v => v.venue_id)
        query = query.not('id', 'in', `(${unavailableIds.join(',')})`)
      }
    }

    // Trier par nom
    query = query.order('name', { ascending: true })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: venues, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des lieux: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: venues || [],
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
        error: error.message || 'Erreur lors de la récupération des lieux'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

