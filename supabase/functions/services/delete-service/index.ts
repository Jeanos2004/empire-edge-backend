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

    // Vérifier si le service est utilisé dans des event_services
    const { count } = await supabaseAdmin
      .from('event_services')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', body.service_id)

    if (count && count > 0) {
      throw new Error('Impossible de supprimer ce service car il est associé à des événements')
    }

    const { error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', body.service_id)

    if (error) {
      throw new Error(`Erreur lors de la suppression du service: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Service supprimé avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la suppression du service' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

