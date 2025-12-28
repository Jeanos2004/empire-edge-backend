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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      throw new Error('Accès réservé aux administrateurs')
    }

    const body = await req.json()

    if (!body.title || !body.slug || !body.content) {
      throw new Error('title, slug et content sont requis')
    }

    // Vérifier que le slug est unique
    const { data: existingPost } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('slug', body.slug)
      .single()

    if (existingPost) {
      throw new Error('Un article avec ce slug existe déjà')
    }

    const { data: post, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        author_id: user.id,
        title: body.title,
        slug: body.slug,
        excerpt: body.excerpt || null,
        content: body.content,
        featured_image: body.featured_image || null,
        category: body.category || null,
        tags: body.tags || [],
        is_published: body.is_published !== undefined ? body.is_published : false,
        published_at: body.is_published ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création de l'article: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: post }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création de l\'article' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

