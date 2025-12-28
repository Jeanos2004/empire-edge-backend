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

    if (!body.rating || !body.comment) {
      throw new Error('rating et comment sont requis')
    }

    if (body.rating < 1 || body.rating > 5) {
      throw new Error('rating doit être entre 1 et 5')
    }

    const { data: testimonial, error } = await supabaseAdmin
      .from('testimonials')
      .insert({
        client_id: body.client_id || null,
        event_id: body.event_id || null,
        rating: body.rating,
        comment: body.comment,
        client_name: body.client_name || null,
        client_photo: body.client_photo || null,
        is_featured: body.is_featured || false,
        is_approved: body.is_approved !== undefined ? body.is_approved : false,
        approved_at: body.is_approved ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création du témoignage: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: testimonial }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création du témoignage' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

