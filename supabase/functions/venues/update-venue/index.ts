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

    if (!body.venue_id) {
      throw new Error('venue_id est requis')
    }

    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.address !== undefined) updates.address = body.address
    if (body.city !== undefined) updates.city = body.city
    if (body.capacity_min !== undefined) updates.capacity_min = body.capacity_min
    if (body.capacity_max !== undefined) updates.capacity_max = body.capacity_max
    if (body.is_indoor !== undefined) updates.is_indoor = body.is_indoor
    if (body.is_unusual !== undefined) updates.is_unusual = body.is_unusual
    if (body.venue_type !== undefined) updates.venue_type = body.venue_type
    if (body.amenities !== undefined) updates.amenities = body.amenities
    if (body.price_per_day !== undefined) updates.price_per_day = body.price_per_day
    if (body.images !== undefined) updates.images = body.images
    if (body.is_available !== undefined) updates.is_available = body.is_available
    if (body.calendar_url !== undefined) updates.calendar_url = body.calendar_url

    const { data: venue, error } = await supabaseAdmin
      .from('venues')
      .update(updates)
      .eq('id', body.venue_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du lieu: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: venue, message: 'Lieu mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du lieu' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

