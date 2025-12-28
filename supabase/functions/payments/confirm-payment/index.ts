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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error(`Profil introuvable: ${profileError?.message || 'Profil non trouvé'}`)
    }

    // Parser le body
    const body = await req.json()

    // Accepter payment_id ou payment_intent_id
    const paymentId = body.payment_id || body.payment_intent_id

    if (!paymentId) {
      throw new Error('payment_id ou payment_intent_id est requis')
    }

    // Vérifier que le paiement existe (utiliser supabaseAdmin pour éviter RLS)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        events(id, client_id)
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      throw new Error(`Paiement introuvable: ${paymentError?.message || 'Paiement non trouvé'}`)
    }

    // Vérifier les permissions (les admins peuvent accéder à tous les paiements)
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || payment.events.client_id !== client.id) {
        throw new Error('Accès non autorisé à ce paiement')
      }
    }

    // Vérifier que le paiement peut être confirmé
    if (payment.status === 'paye') {
      throw new Error('Ce paiement a déjà été confirmé')
    }

    if (payment.status === 'annule') {
      throw new Error('Impossible de confirmer un paiement annulé')
    }

    // TODO: Vérifier avec le service de paiement (Stripe, PayPal, etc.)
    // const paymentIntent = await stripe.paymentIntents.retrieve(payment.transaction_id)
    // if (paymentIntent.status !== 'succeeded') {
    //   throw new Error('Le paiement n\'a pas été validé par le service de paiement')
    // }

    // Mettre à jour le paiement (utiliser supabaseAdmin pour éviter RLS)
    // Accepter receipt_url ou payment_proof_url
    const receiptUrl = body.receipt_url || body.payment_proof_url || null
    const transactionId = body.transaction_id || payment.transaction_id

    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'paye',
        paid_at: new Date().toISOString(),
        payment_method: body.payment_method || payment.payment_method,
        receipt_url: receiptUrl,
        transaction_id: transactionId,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la confirmation du paiement: ${updateError.message}`)
    }

    // Créer une notification pour l'admin (utiliser supabaseAdmin)
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: null, // Notification pour tous les admins
        event_id: payment.event_id,
        type: 'payment_received',
        title: 'Paiement reçu',
        message: `Un paiement de ${payment.amount} GNF a été confirmé`,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedPayment,
        message: 'Paiement confirmé avec succès'
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
        error: error.message || 'Erreur lors de la confirmation du paiement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

