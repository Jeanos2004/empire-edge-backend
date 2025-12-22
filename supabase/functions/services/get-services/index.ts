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

    // Parser les query params
    const url = new URL(req.url)
    const serviceType = url.searchParams.get('service_type')
    const isActive = url.searchParams.get('is_active')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseClient
      .from('services')
      .select('*', { count: 'exact' })

    // Appliquer les filtres
    if (serviceType) {
      query = query.eq('service_type', serviceType)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    } else {
      // Par défaut, ne montrer que les services actifs
      query = query.eq('is_active', true)
    }

    // Trier par nom
    query = query.order('name', { ascending: true })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: services, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des services: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: services || [],
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
        error: error.message || 'Erreur lors de la récupération des services'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

