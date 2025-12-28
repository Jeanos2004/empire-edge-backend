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

    const url = new URL(req.url)
    const messageId = url.searchParams.get('message_id')

    if (!messageId) {
      throw new Error('message_id est requis')
    }

    // Récupérer le message
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, first_name, last_name, avatar_url),
        recipient:profiles!messages_recipient_id_fkey(id, first_name, last_name, avatar_url),
        events(id, title)
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      throw new Error(`Message introuvable: ${messageError?.message || 'Message non trouvé'}`)
    }

    // Vérifier que l'utilisateur est l'expéditeur ou le destinataire
    if (message.sender_id !== user.id && message.recipient_id !== user.id) {
      throw new Error('Accès non autorisé à ce message')
    }

    return new Response(
      JSON.stringify({ success: true, data: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

