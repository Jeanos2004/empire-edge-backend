// @ts-nocheck
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const {
      service_type,
      service_name,
      provider_id,
      provider_name,
      provider_base_price,
      contact_email,
      contact_phone,
      contact_whatsapp,
      supplement_notes,
      client_name,
    } = body

    if (!service_type || !contact_email) {
      throw new Error('service_type et contact_email sont requis')
    }

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const requestNumber = `SRQ-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

    // Insert into settings table under key 'service_requests' (append to array)
    // Actually, let's insert into a dedicated structure stored in the quotes table
    // with a special type, or better: use a separate storage in settings key

    // We'll store service requests in the settings table as a growing list
    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'service_requests')
      .single()

    const requests = existing?.value || []

    const newRequest = {
      id: crypto.randomUUID(),
      request_number: requestNumber,
      status: 'en_attente',
      service_type,
      service_name,
      provider_id,
      provider_name,
      provider_base_price,
      contact_email,
      contact_phone,
      contact_whatsapp,
      supplement_notes,
      client_name,
      created_at: now.toISOString(),
    }

    requests.push(newRequest)

    if (existing) {
      await supabaseAdmin
        .from('settings')
        .update({ value: requests, updated_at: now.toISOString() })
        .eq('key', 'service_requests')
    } else {
      await supabaseAdmin
        .from('settings')
        .insert({ key: 'service_requests', value: requests })
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { request_id: newRequest.id, request_number: requestNumber },
        message: 'Demande de service envoyée avec succès'
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
