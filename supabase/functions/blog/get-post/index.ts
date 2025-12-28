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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const postId = url.searchParams.get('post_id')
    const slug = url.searchParams.get('slug')

    if (!postId && !slug) {
      throw new Error('post_id ou slug est requis')
    }

    let query = supabaseAdmin
      .from('blog_posts')
      .select(`
        *,
        author:profiles!blog_posts_author_id_fkey(id, first_name, last_name, avatar_url)
      `)

    if (postId) {
      query = query.eq('id', postId)
    } else {
      query = query.eq('slug', slug)
    }

    const { data: post, error } = await query.single()

    if (error || !post) {
      throw new Error(`Article introuvable: ${error?.message || 'Article non trouvé'}`)
    }

    // Si l'article n'est pas publié, vérifier que l'utilisateur est admin
    if (!post.is_published) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
            throw new Error('Article non publié - Accès réservé aux administrateurs')
          }
        } else {
          throw new Error('Article non publié - Accès réservé aux administrateurs')
        }
      } else {
        throw new Error('Article non publié - Accès réservé aux administrateurs')
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: post }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération de l\'article' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

