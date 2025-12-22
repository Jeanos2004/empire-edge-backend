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

    // Seuls les admins peuvent créer des devis
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new Error('Au moins un item est requis dans le devis')
    }

    // Vérifier que l'événement existe
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, client_id, status')
      .eq('id', body.event_id)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
    }

    // TODO: Utiliser une transaction PostgreSQL via RPC pour garantir l'atomicité
    // 1. Générer le numéro de devis
    // 2. Calculer les totaux
    // 3. Créer le devis
    // 4. Créer les quote_items
    // 5. Mettre à jour le statut de l'événement si nécessaire

    // Générer le numéro de devis (format: QUO-YYYYMMDD-XXX)
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    
    // Récupérer le dernier numéro de devis du jour
    const { data: lastQuote } = await supabaseClient
      .from('quotes')
      .select('quote_number')
      .like('quote_number', `QUO-${dateStr}-%`)
      .order('quote_number', { ascending: false })
      .limit(1)
      .single()

    let quoteNumber: string
    if (lastQuote && lastQuote.quote_number) {
      const lastNum = parseInt(lastQuote.quote_number.split('-')[2]) || 0
      quoteNumber = `QUO-${dateStr}-${String(lastNum + 1).padStart(3, '0')}`
    } else {
      quoteNumber = `QUO-${dateStr}-001`
    }

    // Calculer les totaux
    let subtotal = 0
    const quoteItems = []

    for (const item of body.items) {
      if (!item.event_service_id && !item.description) {
        throw new Error('Chaque item doit avoir un event_service_id ou une description')
      }

      const quantity = item.quantity || 1
      const unitPrice = item.unit_price || 0
      const totalPrice = quantity * unitPrice
      subtotal += totalPrice

      quoteItems.push({
        event_service_id: item.event_service_id || null,
        description: item.description || null,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
    }

    // Calculer la TVA (18% par défaut en Guinée)
    const taxRate = body.tax_rate || 0.18
    const taxAmount = subtotal * taxRate

    // Calculer la remise
    const discountAmount = body.discount_amount || 0
    if (discountAmount > subtotal) {
      throw new Error('Le montant de la remise ne peut pas être supérieur au sous-total')
    }

    // Calculer le total
    const totalAmount = subtotal + taxAmount - discountAmount

    // Date de validité (30 jours par défaut)
    const validityDate = body.validity_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Créer le devis
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .insert({
        event_id: body.event_id,
        quote_number: quoteNumber,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        validity_date: validityDate,
      })
      .select()
      .single()

    if (quoteError) {
      throw new Error(`Erreur lors de la création du devis: ${quoteError.message}`)
    }

    // Créer les items du devis
    const itemsToInsert = quoteItems.map(item => ({
      ...item,
      quote_id: quote.id,
    }))

    const { error: itemsError } = await supabaseClient
      .from('quote_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback: supprimer le devis créé
      await supabaseClient.from('quotes').delete().eq('id', quote.id)
      throw new Error(`Erreur lors de la création des items: ${itemsError.message}`)
    }

    // Récupérer le devis complet avec items
    const { data: fullQuote, error: fetchError } = await supabaseClient
      .from('quotes')
      .select(`
        *,
        quote_items(*)
      `)
      .eq('id', quote.id)
      .single()

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération du devis: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: fullQuote,
        message: 'Devis créé avec succès'
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
        error: error.message || 'Erreur lors de la création du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

