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

    if (!body.quote_id) {
      throw new Error('quote_id est requis')
    }

    // Vérifier que le devis existe
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select(`
        *,
        events(
          id,
          client_id,
          status
        )
      `)
      .eq('id', body.quote_id)
      .single()

    if (quoteError || !quote) {
      throw new Error('Devis introuvable')
    }

    // Vérifier les permissions (seul le client propriétaire peut accepter)
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || quote.events.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à ce devis')
      }
    }

    // Vérifier que le devis peut être accepté
    if (quote.status !== 'sent' && quote.status !== 'draft') {
      throw new Error(`Impossible d'accepter un devis avec le statut: ${quote.status}`)
    }

    // Vérifier la validité du devis
    if (quote.validity_date && new Date(quote.validity_date) < new Date()) {
      throw new Error('Ce devis a expiré')
    }

    // TODO: Utiliser une transaction PostgreSQL via RPC pour garantir l'atomicité
    // 1. Mettre à jour le statut du devis
    // 2. Créer le contrat
    // 3. Mettre à jour le statut de l'événement

    // Mettre à jour le devis
    const { data: updatedQuote, error: updateError } = await supabaseClient
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', body.quote_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de l'acceptation du devis: ${updateError.message}`)
    }

    // Générer le numéro de contrat
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    
    const { data: lastContract } = await supabaseClient
      .from('contracts')
      .select('contract_number')
      .like('contract_number', `CON-${dateStr}-%`)
      .order('contract_number', { ascending: false })
      .limit(1)
      .single()

    let contractNumber: string
    if (lastContract && lastContract.contract_number) {
      const lastNum = parseInt(lastContract.contract_number.split('-')[2]) || 0
      contractNumber = `CON-${dateStr}-${String(lastNum + 1).padStart(3, '0')}`
    } else {
      contractNumber = `CON-${dateStr}-001`
    }

    // Créer le contrat
    const { data: contract, error: contractError } = await supabaseClient
      .from('contracts')
      .insert({
        quote_id: body.quote_id,
        contract_number: contractNumber,
        content: body.contract_content || `Contrat basé sur le devis ${quote.quote_number}`,
        signed_at: new Date().toISOString(),
        pdf_url: null, // TODO: Générer le PDF du contrat
      })
      .select()
      .single()

    if (contractError) {
      throw new Error(`Erreur lors de la création du contrat: ${contractError.message}`)
    }

    // Mettre à jour le statut de l'événement
    await supabaseClient
      .from('events')
      .update({ status: 'confirmed' })
      .eq('id', quote.events.id)

    // Créer une notification pour l'admin
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: null, // Notification pour tous les admins
        event_id: quote.events.id,
        type: 'quote_accepted',
        title: 'Devis accepté',
        message: `Le devis ${quote.quote_number} a été accepté`,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          quote: updatedQuote,
          contract: contract,
        },
        message: 'Devis accepté avec succès'
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
        error: error.message || 'Erreur lors de l\'acceptation du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

