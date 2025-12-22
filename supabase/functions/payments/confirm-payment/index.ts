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

    if (!body.payment_id) {
      throw new Error('payment_id est requis')
    }

    // Vérifier que le paiement existe
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select(`
        *,
        events(id, client_id)
      `)
      .eq('id', body.payment_id)
      .single()

    if (paymentError || !payment) {
      throw new Error('Paiement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || payment.events.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à ce paiement')
      }
    }

    // Vérifier que le paiement peut être confirmé
    if (payment.status === 'paid') {
      throw new Error('Ce paiement a déjà été confirmé')
    }

    if (payment.status === 'cancelled') {
      throw new Error('Impossible de confirmer un paiement annulé')
    }

    // TODO: Vérifier avec le service de paiement (Stripe, PayPal, etc.)
    // const paymentIntent = await stripe.paymentIntents.retrieve(payment.transaction_id)
    // if (paymentIntent.status !== 'succeeded') {
    //   throw new Error('Le paiement n\'a pas été validé par le service de paiement')
    // }

    // Mettre à jour le paiement
    const { data: updatedPayment, error: updateError } = await supabaseClient
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: body.payment_method || payment.payment_method,
        receipt_url: body.receipt_url || null,
      })
      .eq('id', body.payment_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la confirmation du paiement: ${updateError.message}`)
    }

    // Créer une notification pour l'admin
    await supabaseClient
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

