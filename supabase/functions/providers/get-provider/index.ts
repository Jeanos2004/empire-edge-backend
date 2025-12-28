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
    const providerId = url.searchParams.get('provider_id')

    if (!providerId) {
      throw new Error('provider_id est requis')
    }

    const { data: provider, error } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single()

    if (error || !provider) {
      throw new Error(`Prestataire introuvable: ${error?.message || 'Prestataire non trouvé'}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du prestataire' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

