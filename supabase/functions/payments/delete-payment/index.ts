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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
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

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    const body = await req.json()

    if (!body.payment_id) {
      throw new Error('payment_id est requis')
    }

    // Vérifier que le paiement existe
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('event_id, status')
      .eq('id', body.payment_id)
      .single()

    if (!existingPayment) {
      throw new Error('Paiement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable')
      }

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('client_id')
        .eq('id', existingPayment.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à ce paiement')
      }
    }

    // Ne pas permettre de supprimer un paiement déjà payé (sauf admin)
    if (existingPayment.status === 'paye' && profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Impossible de supprimer un paiement déjà payé')
    }

    const { error } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', body.payment_id)

    if (error) {
      throw new Error(`Erreur lors de la suppression du paiement: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Paiement supprimé avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la suppression du paiement' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

