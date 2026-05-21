// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Non authentifié')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      throw new Error('Accès réservé aux administrateurs')
    }

    const body = await req.json()

    // ----------------------------------------------------
    // CASE 1: Assign to a Quote (Devis) during Analysis phase
    // ----------------------------------------------------
    if (body.quote_id && body.service_id) {
      if (!body.provider_id) throw new Error('provider_id est requis')
      if (body.provider_price === undefined) throw new Error('provider_price est requis')

      // Fetch the provider to get its details
      const { data: provider, error: providerError } = await supabaseAdmin
        .from('providers')
        .select('id, name')
        .eq('id', body.provider_id)
        .single()

      if (providerError || !provider) {
        throw new Error('Prestataire introuvable')
      }

      // Fetch the quote
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', body.quote_id)
        .single()

      if (quoteError || !quote) throw new Error('Devis introuvable')

      const reqData = quote.request_data || {}
      const assignedProviders = reqData.assigned_providers || {}
      
      // Update the assigned_providers object with the new assignment
      assignedProviders[body.service_id] = {
        provider_id: body.provider_id,
        provider_name: provider.name,
        provider_price: Number(body.provider_price)
      }

      reqData.assigned_providers = assignedProviders

      // Update the quote
      const { data: updatedQuote, error: updateError } = await supabaseAdmin
        .from('quotes')
        .update({ request_data: reqData })
        .eq('id', body.quote_id)
        .select()
        .single()

      if (updateError) throw new Error(`Erreur lors de la mise à jour du devis: ${updateError.message}`)

      return new Response(
        JSON.stringify({
          success: true,
          data: updatedQuote,
          message: 'Prestataire assigné au devis avec succès'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ----------------------------------------------------
    // CASE 2: Assign to an Event Service (Existing Logic)
    // ----------------------------------------------------
    if (!body.event_service_id) {
      throw new Error('event_service_id ou (quote_id et service_id) est requis')
    }

    if (!body.provider_id) {
      throw new Error('provider_id est requis')
    }

    const { data: eventService, error: eventServiceError } = await supabaseClient
      .from('event_services')
      .select('*, services(service_type), events(id, status)')
      .eq('id', body.event_service_id)
      .single()

    if (eventServiceError || !eventService) {
      throw new Error('Service événement introuvable')
    }

    const { data: provider, error: providerError } = await supabaseClient
      .from('providers')
      .select('id, name, service_type, specialties')
      .eq('id', body.provider_id)
      .single()

    if (providerError || !provider) {
      throw new Error('Prestataire introuvable')
    }

    if (eventService.services && provider.service_type && eventService.services.service_type !== provider.service_type) {
      const specialties = provider.specialties || []
      if (!specialties.includes(eventService.services.service_type)) {
        throw new Error('Le prestataire ne correspond pas au type de service')
      }
    }

    // Prepare update data, include provider_price if provided
    const updateData: any = { provider_id: body.provider_id }

    const { data: updatedEventService, error: updateError } = await supabaseClient
      .from('event_services')
      .update(updateData)
      .eq('id', body.event_service_id)
      .select('*, services(*), providers(*)')
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de l'assignation: ${updateError.message}`)
    }

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

