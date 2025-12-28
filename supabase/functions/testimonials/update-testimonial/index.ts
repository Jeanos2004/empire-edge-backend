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

    if (!body.testimonial_id) {
      throw new Error('testimonial_id est requis')
    }

    if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
      throw new Error('rating doit être entre 1 et 5')
    }

    const updates: any = {}
    if (body.rating !== undefined) updates.rating = body.rating
    if (body.comment !== undefined) updates.comment = body.comment
    if (body.client_name !== undefined) updates.client_name = body.client_name
    if (body.client_photo !== undefined) updates.client_photo = body.client_photo
    if (body.is_featured !== undefined) updates.is_featured = body.is_featured
    if (body.is_approved !== undefined) {
      updates.is_approved = body.is_approved
      if (body.is_approved) {
        updates.approved_at = new Date().toISOString()
      }
    }

    const { data: testimonial, error } = await supabaseAdmin
      .from('testimonials')
      .update(updates)
      .eq('id', body.testimonial_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du témoignage: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: testimonial, message: 'Témoignage mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du témoignage' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

