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

    if (!body.recipient_id) {
      throw new Error('recipient_id est requis')
    }

    if (!body.content) {
      throw new Error('content est requis')
    }

    // Vérifier que le destinataire existe
    const { data: recipient, error: recipientError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', body.recipient_id)
      .single()

    if (recipientError || !recipient) {
      throw new Error('Destinataire introuvable')
    }

    // Vérifier que l'événement existe si fourni
    if (body.event_id) {
      const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select('id')
        .eq('id', body.event_id)
        .single()

      if (eventError || !event) {
        throw new Error('Événement introuvable')
      }
    }

    // Créer le message
    const { data: message, error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: body.recipient_id,
        event_id: body.event_id || null,
        subject: body.subject || null,
        content: body.content,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Erreur lors de l'envoi du message: ${insertError.message}`)
    }

    // Créer une notification pour le destinataire
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: body.recipient_id,
        event_id: body.event_id || null,
        type: 'new_message',
        title: body.subject || 'Nouveau message',
        message: body.content.substring(0, 100) + (body.content.length > 100 ? '...' : ''),
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

