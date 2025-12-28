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

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    if (!body.service_id) {
      throw new Error('service_id est requis')
    }

    // Vérifier que l'événement existe (utiliser supabaseAdmin pour éviter RLS)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_id, status')
      .eq('id', body.event_id)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
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

      if (!client || event.client_id !== client.id) {
        // Les admins peuvent accéder à tous les événements
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Vérifier que le service existe et est actif (utiliser supabaseAdmin pour éviter RLS)
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, name, base_price, service_type, is_active')
      .eq('id', body.service_id)
      .single()

    if (serviceError || !service) {
      throw new Error(`Service introuvable: ${serviceError?.message || 'Service non trouvé'}`)
    }

    if (!service.is_active) {
      throw new Error('Ce service n\'est plus actif')
    }

    // Vérifier si le service n'est pas déjà ajouté à l'événement (utiliser supabaseAdmin)
    const { data: existingService } = await supabaseAdmin
      .from('event_services')
      .select('id')
      .eq('event_id', body.event_id)
      .eq('service_id', body.service_id)
      .maybeSingle()

    if (existingService) {
      throw new Error('Ce service est déjà ajouté à cet événement')
    }

    // Calculer le prix
    const quantity = body.quantity || 1
    const unitPrice = body.unit_price || service.base_price || 0
    const totalPrice = quantity * unitPrice

    // Créer l'entrée event_service (utiliser supabaseAdmin pour éviter RLS)
    const { data: eventService, error: insertError } = await supabaseAdmin
      .from('event_services')
      .insert({
        event_id: body.event_id,
        service_id: body.service_id,
        provider_id: body.provider_id || null,
        configuration: body.configuration || {},
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Erreur lors de l'ajout du service: ${insertError.message}`)
    }

    // Récupérer le service complet avec relations (utiliser supabaseAdmin)
    const { data: fullEventService, error: fetchError } = await supabaseAdmin
      .from('event_services')
      .select(`
        *,
        services(*),
        providers(*)
      `)
      .eq('id', eventService.id)
      .single()

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération du service: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: fullEventService,
        message: 'Service ajouté à l\'événement avec succès'
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
        error: error.message || 'Erreur lors de l\'ajout du service'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

