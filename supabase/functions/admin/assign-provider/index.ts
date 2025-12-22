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

    // Seuls les admins peuvent assigner des prestataires
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_service_id) {
      throw new Error('event_service_id est requis')
    }

    if (!body.provider_id) {
      throw new Error('provider_id est requis')
    }

    // Vérifier que l'event_service existe
    const { data: eventService, error: eventServiceError } = await supabaseClient
      .from('event_services')
      .select(`
        *,
        services(service_type),
        events(id, status)
      `)
      .eq('id', body.event_service_id)
      .single()

    if (eventServiceError || !eventService) {
      throw new Error('Service événement introuvable')
    }

    // Vérifier que le prestataire existe
    const { data: provider, error: providerError } = await supabaseClient
      .from('providers')
      .select('id, name, service_type, specialties')
      .eq('id', body.provider_id)
      .single()

    if (providerError || !provider) {
      throw new Error('Prestataire introuvable')
    }

    // Vérifier que le prestataire correspond au type de service
    if (eventService.services && provider.service_type && eventService.services.service_type !== provider.service_type) {
      // Vérifier si le prestataire a cette spécialité
      const specialties = provider.specialties || []
      if (!specialties.includes(eventService.services.service_type)) {
        throw new Error('Le prestataire ne correspond pas au type de service')
      }
    }

    // Mettre à jour l'event_service
    const { data: updatedEventService, error: updateError } = await supabaseClient
      .from('event_services')
      .update({
        provider_id: body.provider_id,
      })
      .eq('id', body.event_service_id)
      .select(`
        *,
        services(*),
        providers(*)
      `)
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de l'assignation: ${updateError.message}`)
    }

    // Créer une notification pour le prestataire (si possible)
    // Note: Les prestataires ne sont pas nécessairement des utilisateurs du système
    // Cette partie devrait être adaptée selon votre architecture

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedEventService,
        message: 'Prestataire assigné avec succès'
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
        error: error.message || 'Erreur lors de l\'assignation du prestataire'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

