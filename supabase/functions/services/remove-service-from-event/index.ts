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

    // Récupérer le profil
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_service_id) {
      throw new Error('event_service_id est requis')
    }

    // Vérifier que l'event_service existe
    const { data: eventService, error: fetchError } = await supabaseClient
      .from('event_services')
      .select(`
        *,
        events(id, client_id, status)
      `)
      .eq('id', body.event_service_id)
      .single()

    if (fetchError || !eventService) {
      throw new Error('Service introuvable dans cet événement')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || eventService.events.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Vérifier si l'événement peut être modifié
    if (eventService.events.status === 'termine' || eventService.events.status === 'annule') {
      throw new Error('Impossible de modifier un événement terminé ou annulé')
    }

    // Vérifier si le service est dans un devis accepté
    const { data: acceptedQuote } = await supabaseClient
      .from('quote_items')
      .select('quote_id, quotes(status)')
      .eq('event_service_id', body.event_service_id)
      .eq('quotes.status', 'accepte')
      .limit(1)
      .single()

    if (acceptedQuote) {
      throw new Error('Impossible de retirer un service inclus dans un devis accepté')
    }

    // Supprimer le service de l'événement
    const { error: deleteError } = await supabaseClient
      .from('event_services')
      .delete()
      .eq('id', body.event_service_id)

    if (deleteError) {
      throw new Error(`Erreur lors de la suppression: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Service retiré de l\'événement avec succès'
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
        error: error.message || 'Erreur lors de la suppression du service'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

