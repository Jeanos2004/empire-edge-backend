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

    if (!body.post_id) {
      throw new Error('post_id est requis')
    }

    // Vérifier que l'article existe
    const { data: existingPost } = await supabaseAdmin
      .from('blog_posts')
      .select('id, slug')
      .eq('id', body.post_id)
      .single()

    if (!existingPost) {
      throw new Error('Article introuvable')
    }

    // Vérifier que le slug est unique (si modifié)
    if (body.slug && body.slug !== existingPost.slug) {
      const { data: slugExists } = await supabaseAdmin
        .from('blog_posts')
        .select('id')
        .eq('slug', body.slug)
        .single()

      if (slugExists) {
        throw new Error('Un article avec ce slug existe déjà')
      }
    }

    const updates: any = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt
    if (body.content !== undefined) updates.content = body.content
    if (body.featured_image !== undefined) updates.featured_image = body.featured_image
    if (body.category !== undefined) updates.category = body.category
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.is_published !== undefined) {
      updates.is_published = body.is_published
      if (body.is_published && !existingPost.published_at) {
        updates.published_at = new Date().toISOString()
      }
    }

    const { data: post, error } = await supabaseAdmin
      .from('blog_posts')
      .update(updates)
      .eq('id', body.post_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'article: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: post, message: 'Article mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour de l\'article' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

