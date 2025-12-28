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

    // Vérifier que le message existe et que l'utilisateur est l'expéditeur
    const { data: existingMessage } = await supabaseAdmin
      .from('messages')
      .select('sender_id')
      .eq('id', body.message_id)
      .single()

    if (!existingMessage) {
      throw new Error('Message introuvable')
    }

    // Seul l'expéditeur peut modifier son message
    if (existingMessage.sender_id !== user.id) {
      throw new Error('Vous ne pouvez modifier que vos propres messages')
    }

    const updates: any = {}
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.content !== undefined) updates.content = body.content

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .update(updates)
      .eq('id', body.message_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du message: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: message, message: 'Message mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

