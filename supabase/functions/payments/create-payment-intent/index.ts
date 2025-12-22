import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour générer un ID de transaction unique
async function generateTransactionId(): Promise<string> {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
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

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      throw new Error('amount doit être un nombre positif')
    }

    // Vérifier que l'événement existe
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, client_id')
      .eq('id', body.event_id)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || event.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Vérifier s'il y a un devis accepté
    let quoteId = body.quote_id || null
    if (!quoteId) {
      const { data: acceptedQuote } = await supabaseClient
        .from('quotes')
        .select('id, total_amount')
        .eq('event_id', body.event_id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (acceptedQuote) {
        quoteId = acceptedQuote.id
      }
    }

    // Générer un ID de transaction
    const transactionId = await generateTransactionId()

    // Calculer la date d'échéance (30 jours par défaut)
    const dueDate = body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Créer l'intention de paiement
    const { data: payment, error: insertError } = await supabaseClient
      .from('payments')
      .insert({
        event_id: body.event_id,
        quote_id: quoteId,
        payment_type: body.payment_type || 'partial',
        amount: body.amount,
        status: 'pending',
        due_date: dueDate,
        transaction_id: transactionId,
        payment_method: body.payment_method || null,
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Erreur lors de la création de l'intention de paiement: ${insertError.message}`)
    }

    // TODO: Intégrer avec un service de paiement (Stripe, PayPal, etc.)
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: body.amount * 100, // Convertir en centimes
    //   currency: 'gnf',
    //   metadata: {
    //     event_id: body.event_id,
    //     transaction_id: transactionId,
    //   }
    // })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          payment: payment,
          transaction_id: transactionId,
          // client_secret: paymentIntent.client_secret, // Pour Stripe
        },
        message: 'Intention de paiement créée avec succès'
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
        error: error.message || 'Erreur lors de la création de l\'intention de paiement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

