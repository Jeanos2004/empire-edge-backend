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

    // Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que le destinataire existe
    const body = await req.json()

    if (!body.recipient_id) {
      throw new Error('recipient_id est requis')
    }

    if (!body.content) {
      throw new Error('content est requis')
    }

    // Vérifier que le destinataire existe (utiliser supabaseAdmin pour éviter RLS)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', body.recipient_id)
      .single()

    if (recipientError || !recipient) {
      throw new Error('Destinataire introuvable')
    }

    // Créer le message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        event_id: body.event_id || null,
        sender_id: user.id,
        recipient_id: body.recipient_id,
        subject: body.subject || null,
        content: body.content,
        is_read: false,
        parent_message_id: body.parent_message_id || null,
      })
      .select()
      .single()

    if (messageError) {
      throw new Error(`Erreur lors de l'envoi du message: ${messageError.message}`)
    }

    // Créer une notification pour le destinataire
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: body.recipient_id,
        event_id: body.event_id || null,
        type: 'new_message',
        title: 'Nouveau message',
        message: `Vous avez reçu un nouveau message${body.subject ? `: ${body.subject}` : ''}`,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: true,
        data: message,
        message: 'Message envoyé avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de l\'envoi du message'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
