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

    if (!body.service_id) {
      throw new Error('service_id est requis')
    }

    const updates: any = {}
    if (body.service_type !== undefined) {
      const validServiceTypes = ['reservation_lieu', 'traiteur_boissons', 'decoration_design', 'animations_artistes', 'photo_video', 'gestion_invites', 'location_materiel', 'communication_marketing', 'streaming_hybride']
      if (!validServiceTypes.includes(body.service_type)) {
        throw new Error(`service_type invalide. Valeurs acceptées: ${validServiceTypes.join(', ')}`)
      }
      updates.service_type = body.service_type
    }
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.base_price !== undefined) updates.base_price = body.base_price
    if (body.unit !== undefined) updates.unit = body.unit
    if (body.is_customizable !== undefined) updates.is_customizable = body.is_customizable
    if (body.configuration_schema !== undefined) updates.configuration_schema = body.configuration_schema
    if (body.images !== undefined) updates.images = body.images
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.display_order !== undefined) updates.display_order = body.display_order

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .update(updates)
      .eq('id', body.service_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du service: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: service, message: 'Service mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du service' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

