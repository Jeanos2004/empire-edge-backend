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

    if (!body.name || !body.address || !body.city || !body.capacity_max) {
      throw new Error('name, address, city et capacity_max sont requis')
    }

    const { data: venue, error } = await supabaseAdmin
      .from('venues')
      .insert({
        name: body.name,
        description: body.description || null,
        address: body.address,
        city: body.city,
        capacity_min: body.capacity_min || null,
        capacity_max: body.capacity_max,
        is_indoor: body.is_indoor !== undefined ? body.is_indoor : true,
        is_unusual: body.is_unusual || false,
        venue_type: body.venue_type || null,
        amenities: body.amenities || [],
        price_per_day: body.price_per_day || null,
        images: body.images || [],
        is_available: body.is_available !== undefined ? body.is_available : true,
        calendar_url: body.calendar_url || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création du lieu: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: venue }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création du lieu' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

