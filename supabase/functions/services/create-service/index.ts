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

    if (!body.service_type || !body.name) {
      throw new Error('service_type et name sont requis')
    }

    const validServiceTypes = ['reservation_lieu', 'traiteur_boissons', 'decoration_design', 'animations_artistes', 'photo_video', 'gestion_invites', 'location_materiel', 'communication_marketing', 'streaming_hybride']
    if (!validServiceTypes.includes(body.service_type)) {
      throw new Error(`service_type invalide. Valeurs acceptées: ${validServiceTypes.join(', ')}`)
    }

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .insert({
        service_type: body.service_type,
        name: body.name,
        description: body.description || null,
        base_price: body.base_price || null,
        unit: body.unit || null,
        is_customizable: body.is_customizable !== undefined ? body.is_customizable : true,
        configuration_schema: body.configuration_schema || null,
        images: body.images || [],
        is_active: body.is_active !== undefined ? body.is_active : true,
        display_order: body.display_order || 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création du service: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: service }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création du service' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

