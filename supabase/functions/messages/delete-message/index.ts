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

    if (!body.message_id) {
      throw new Error('message_id est requis')
    }

    // Vérifier que le message existe et que l'utilisateur est l'expéditeur ou le destinataire
    const { data: existingMessage } = await supabaseAdmin
      .from('messages')
      .select('sender_id, recipient_id')
      .eq('id', body.message_id)
      .single()

    if (!existingMessage) {
      throw new Error('Message introuvable')
    }

    // L'expéditeur ou le destinataire peuvent supprimer le message
    if (existingMessage.sender_id !== user.id && existingMessage.recipient_id !== user.id) {
      throw new Error('Accès non autorisé à ce message')
    }

    const { error } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', body.message_id)

    if (error) {
      throw new Error(`Erreur lors de la suppression du message: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Message supprimé avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la suppression du message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

