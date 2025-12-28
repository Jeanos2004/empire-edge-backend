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

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    const url = new URL(req.url)
    const documentId = url.searchParams.get('document_id')

    if (!documentId) {
      throw new Error('document_id est requis')
    }

    // Récupérer le document
    const { data: document, error: documentError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (documentError || !document) {
      throw new Error(`Document introuvable: ${documentError?.message || 'Document non trouvé'}`)
    }

    // Vérifier les permissions pour les clients
    if (profile.role === 'client' && document.event_id) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable')
      }

      // Vérifier que l'événement appartient au client
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('client_id')
        .eq('id', document.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à ce document')
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: document }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du document' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

