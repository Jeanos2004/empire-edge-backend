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

    if (!body.notification_id) {
      throw new Error('notification_id est requis')
    }

    // Vérifier que la notification existe
    const { data: existingNotification } = await supabaseAdmin
      .from('notifications')
      .select('user_id')
      .eq('id', body.notification_id)
      .single()

    if (!existingNotification) {
      throw new Error('Notification introuvable')
    }

    // Vérifier que l'utilisateur est le propriétaire
    if (existingNotification.user_id !== user.id) {
      throw new Error('Accès non autorisé à cette notification')
    }

    const updates: any = {}
    if (body.is_read !== undefined) {
      updates.is_read = body.is_read
      if (body.is_read) {
        updates.read_at = new Date().toISOString()
      }
    }

    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .update(updates)
      .eq('id', body.notification_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de la notification: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: notification, message: 'Notification mise à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour de la notification' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

