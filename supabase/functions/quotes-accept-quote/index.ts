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

    const body = await req.json()
    const { quote_id } = body

    if (!quote_id) throw new Error('quote_id est requis')

    // 1. Récupérer le devis
    const { data: quote, error: qError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .single()

    if (qError || !quote) throw new Error('Devis introuvable')

    const reqData = quote.request_data || {}

    // 2. Créer l'événement réel (les types correspondent maintenant directement)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        event_type: reqData.event_type || 'reception_privee',
        event_category: reqData.event_type === 'seminaire' ? 'corporate_professionnel' : 'prive_familial',
        title: `Événement - ${reqData.event_type || 'Nouveau'}`,
        description: reqData.notes || '',
        event_date: reqData.event_date || new Date().toISOString().split('T')[0],
        guest_count: parseInt(reqData.guest_count || 0),
        status: 'confirme',
        style: reqData.style || 'moderne',
        budget_max: quote.total_amount,
        special_requirements: reqData.notes,
      })
      .select()
      .single()

    if (eventError) throw new Error(`Erreur Création Événement: ${eventError.message}`)

    // 3. Mettre à jour le devis
    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({
        event_id: event.id,
        status: 'accepte',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', quote_id)

    if (updateError) throw new Error(`Erreur Liaison Devis: ${updateError.message}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { event_id: event.id, quote_id: quote.id },
        message: 'Devis validé et événement créé avec succès'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
