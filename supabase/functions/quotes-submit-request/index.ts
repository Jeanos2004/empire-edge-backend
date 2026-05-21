// @ts-nocheck
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    let userId = null
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await supabaseClient.auth.getUser()
      userId = user?.id
    }

    const body = await req.json()
    const { event_type, event_date, guest_count, desired_location, services, services_preferences, details } = body

    // Aplatir l'objet des services (ex: { mariage_services: ['hall', 'catering'] } -> ['hall', 'catering'])
    const flattenedServices = []
    if (services && typeof services === 'object') {
      Object.values(services).forEach(categoryServices => {
        if (Array.isArray(categoryServices)) {
          flattenedServices.push(...categoryServices)
        }
      })
    }

    const requestData = {
      event_type,
      event_date,
      guest_count,
      location: desired_location,
      services: flattenedServices,
      services_preferences,
      ...details
    }

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const quoteNumber = `REQ-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

    // Créer le devis SANS événement
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        status: 'en_attente',
        subtotal: details?.budget || 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: details?.budget || 0,
        request_data: requestData, // On stocke tout ici
        notes: `Demande publique pour ${event_type} le ${event_date}`,
      })
      .select()
      .single()

    if (quoteError) {
      throw new Error(`Erreur lors de la création du devis: ${quoteError.message}. Vérifiez que event_id est nullable.`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { quote_id: quote.id, quote_number: quoteNumber },
        message: 'Demande envoyée avec succès'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
