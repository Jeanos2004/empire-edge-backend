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

    if (!body.provider_id) {
      throw new Error('provider_id est requis')
    }

    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.service_type !== undefined) {
      const validServiceTypes = ['reservation_lieu', 'traiteur_boissons', 'decoration_design', 'animations_artistes', 'photo_video', 'gestion_invites', 'location_materiel', 'communication_marketing', 'streaming_hybride']
      if (!validServiceTypes.includes(body.service_type)) {
        throw new Error(`service_type invalide. Valeurs acceptées: ${validServiceTypes.join(', ')}`)
      }
      updates.service_type = body.service_type
    }
    if (body.contact_name !== undefined) updates.contact_name = body.contact_name
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.address !== undefined) updates.address = body.address
    if (body.description !== undefined) updates.description = body.description
    if (body.rating !== undefined) updates.rating = body.rating
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.specialties !== undefined) updates.specialties = body.specialties
    if (body.price_range_min !== undefined) updates.price_range_min = body.price_range_min
    if (body.price_range_max !== undefined) updates.price_range_max = body.price_range_max
    if (body.portfolio_images !== undefined) updates.portfolio_images = body.portfolio_images

    const { data: provider, error } = await supabaseAdmin
      .from('providers')
      .update(updates)
      .eq('id', body.provider_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du prestataire: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: provider, message: 'Prestataire mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du prestataire' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

