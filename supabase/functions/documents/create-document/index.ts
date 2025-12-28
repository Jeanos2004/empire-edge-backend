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

    const body = await req.json()

    if (!body.document_type || !body.title || !body.file_url) {
      throw new Error('document_type, title et file_url sont requis')
    }

    // Au moins un ID de référence doit être fourni
    if (!body.event_id && !body.quote_id && !body.contract_id) {
      throw new Error('Au moins un des champs suivants est requis: event_id, quote_id, contract_id')
    }

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .insert({
        event_id: body.event_id || null,
        quote_id: body.quote_id || null,
        contract_id: body.contract_id || null,
        document_type: body.document_type,
        title: body.title,
        file_url: body.file_url,
        file_size: body.file_size || null,
        mime_type: body.mime_type || null,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création du document: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: document }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création du document' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

