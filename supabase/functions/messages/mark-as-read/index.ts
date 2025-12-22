import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Créer client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Vérifier authentification
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Non authentifié')
    }

    // Parser le body
    const body = await req.json()

    if (!body.message_id && !body.message_ids) {
      throw new Error('message_id ou message_ids est requis')
    }

    // Construire la requête de mise à jour
    let query = supabaseClient
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', user.id) // Seul le destinataire peut marquer comme lu

    // Appliquer le filtre
    if (body.message_id) {
      query = query.eq('id', body.message_id)
    } else if (body.message_ids && Array.isArray(body.message_ids)) {
      query = query.in('id', body.message_ids)
    }

    // Exécuter la mise à jour
    const { data: updatedMessages, error: updateError } = await query.select()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedMessages,
        message: 'Message(s) marqué(s) comme lu(s)'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de la mise à jour du message'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

