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
    // Créer client Supabase avec service role pour éviter les problèmes RLS
    // Cette fonction est publique mais doit contourner RLS pour les JOINs avec profiles
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const isFeatured = url.searchParams.get('is_featured')
    const rating = url.searchParams.get('rating')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Construire la requête (utiliser supabaseAdmin pour éviter RLS)
    // Récupérer d'abord les témoignages de base
    let query = supabaseAdmin
      .from('testimonials')
      .select('*', { count: 'exact' })
      .eq('is_approved', true) // Seulement les témoignages approuvés

    // Appliquer les filtres
    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    if (isFeatured === 'true') {
      query = query.eq('is_featured', true)
    }

    if (rating) {
      query = query.eq('rating', parseInt(rating))
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: testimonialsBase, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des témoignages: ${error.message}`)
    }

    // Récupérer les relations séparément pour éviter les problèmes de JOIN
    const testimonialsWithRelations = await Promise.all((testimonialsBase || []).map(async (testimonial: any) => {
      const [clientResult, eventResult] = await Promise.all([
        // Client avec profil
        testimonial.client_id ? supabaseAdmin
          .from('clients')
          .select(`
            id,
            profile_id,
            profiles!inner(id, first_name, last_name, avatar_url)
          `)
          .eq('id', testimonial.client_id)
          .single() : Promise.resolve({ data: null, error: null }),
        
        // Événement
        testimonial.event_id ? supabaseAdmin
          .from('events')
          .select('id, title, event_type')
          .eq('id', testimonial.event_id)
          .single() : Promise.resolve({ data: null, error: null })
      ])

      return {
        ...testimonial,
        clients: clientResult.data,
        events: eventResult.data
      }
    }))

    // Calculer la note moyenne
    const ratings = testimonialsWithRelations?.map((t: any) => t.rating) || []
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
      : 0

    return new Response(
      JSON.stringify({
        success: true,
        data: testimonialsWithRelations || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats: {
          total: count || 0,
          average_rating: Math.round(averageRating * 10) / 10,
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
        error: error.message || 'Erreur lors de la récupération des témoignages'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

