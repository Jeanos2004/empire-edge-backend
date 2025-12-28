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
    const venueId = url.searchParams.get('venue_id')

    if (!venueId) {
      throw new Error('venue_id est requis')
    }

    const { data: venue, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .single()

    if (error || !venue) {
      throw new Error(`Lieu introuvable: ${error?.message || 'Lieu non trouvé'}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: venue }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du lieu' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

