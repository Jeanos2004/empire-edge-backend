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

    // Récupérer le profil
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Seuls les admins peuvent créer des notifications système
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.user_id && body.user_id !== null) {
      throw new Error('user_id est requis (ou null pour notification globale)')
    }

    if (!body.type) {
      throw new Error('type est requis')
    }

    if (!body.title) {
      throw new Error('title est requis')
    }

    if (!body.message) {
      throw new Error('message est requis')
    }

    // Créer la notification
    const { data: notification, error: insertError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: body.user_id,
        event_id: body.event_id || null,
        type: body.type,
        title: body.title,
        message: body.message,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Erreur lors de la création de la notification: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: notification,
        message: 'Notification créée avec succès'
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
        error: error.message || 'Erreur lors de la création de la notification'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

