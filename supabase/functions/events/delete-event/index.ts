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

    // Parser le body
    const body = await req.json()

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    // Vérifier que l'événement existe et les permissions
    const { data: existingEvent, error: fetchError } = await supabaseClient
      .from('events')
      .select('client_id, status')
      .eq('id', body.event_id)
      .single()

    if (fetchError || !existingEvent) {
      throw new Error('Événement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || existingEvent.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Vérifier si l'événement peut être supprimé
    // Ne pas supprimer si un devis a été accepté
    const { data: acceptedQuote } = await supabaseClient
      .from('quotes')
      .select('id')
      .eq('event_id', body.event_id)
      .eq('status', 'accepted')
      .limit(1)
      .single()

    if (acceptedQuote) {
      throw new Error('Impossible de supprimer un événement avec un devis accepté. Veuillez d\'abord annuler le devis.')
    }

    // Vérifier s'il y a des paiements
    const { data: payments } = await supabaseClient
      .from('payments')
      .select('id, status')
      .eq('event_id', body.event_id)
      .eq('status', 'paid')
      .limit(1)

    if (payments && payments.length > 0) {
      throw new Error('Impossible de supprimer un événement avec des paiements effectués')
    }

    // Supprimer l'événement (les relations seront supprimées en cascade si configuré dans la DB)
    const { error: deleteError } = await supabaseClient
      .from('events')
      .delete()
      .eq('id', body.event_id)

    if (deleteError) {
      throw new Error(`Erreur lors de la suppression: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Événement supprimé avec succès'
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
        error: error.message || 'Erreur lors de la suppression de l\'événement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

