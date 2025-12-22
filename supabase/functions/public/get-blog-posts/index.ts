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
    // Créer client Supabase (pas besoin d'authentification pour les posts publics)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parser les query params
    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const tag = url.searchParams.get('tag')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Construire la requête
    let query = supabaseClient
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .eq('is_published', true) // Seulement les posts publiés

    // Appliquer les filtres
    if (category) {
      query = query.eq('category', category)
    }

    if (tag) {
      query = query.contains('tags', [tag])
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: posts, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des articles: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: posts || [],
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
        error: error.message || 'Erreur lors de la récupération des articles'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

