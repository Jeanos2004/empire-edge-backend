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
    // Créer client Supabase (pas besoin d'authentification)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const minRating = url.searchParams.get('min_rating')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    // Construire la requête
    let query = supabaseClient
      .from('testimonials')
      .select(`
        *,
        clients!inner(
          profile_id,
          profiles!inner(first_name, last_name, avatar_url)
        ),
        events(id, title, event_type)
      `)
      .eq('is_approved', true) // Seulement les témoignages approuvés

    // Appliquer les filtres
    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    if (minRating) {
      query = query.gte('rating', parseInt(minRating))
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Limite
    query = query.limit(limit)

    // Exécuter la requête
    const { data: testimonials, error } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des témoignages: ${error.message}`)
    }

    // Calculer la note moyenne
    const ratings = testimonials?.map((t: any) => t.rating) || []
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length
      : 0

    return new Response(
      JSON.stringify({
        success: true,
        data: testimonials || [],
        stats: {
          total: testimonials?.length || 0,
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

