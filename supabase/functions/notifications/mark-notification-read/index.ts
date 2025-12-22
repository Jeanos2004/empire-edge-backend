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

    if (!body.notification_id && !body.notification_ids) {
      throw new Error('notification_id ou notification_ids est requis')
    }

    // Construire la requête de mise à jour
    let query = supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .or(`user_id.eq.${user.id},user_id.is.null`) // L'utilisateur peut marquer ses notifications ou les notifications globales

    // Appliquer le filtre
    if (body.notification_id) {
      query = query.eq('id', body.notification_id)
    } else if (body.notification_ids && Array.isArray(body.notification_ids)) {
      query = query.in('id', body.notification_ids)
    }

    // Exécuter la mise à jour
    const { data: updatedNotifications, error: updateError } = await query.select()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedNotifications,
        message: 'Notification(s) marquée(s) comme lue(s)'
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
        error: error.message || 'Erreur lors de la mise à jour de la notification'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

