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

    // Seuls les admins peuvent générer des factures
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_id && !body.quote_id) {
      throw new Error('event_id ou quote_id est requis')
    }

    // Récupérer les données nécessaires
    let quote: any = null
    let event: any = null

    if (body.quote_id) {
      const { data: quoteData, error: quoteError } = await supabaseClient
        .from('quotes')
        .select(`
          *,
          quote_items(*),
          events(
            *,
            clients!inner(
              profile_id,
              address,
              city,
              profiles!inner(first_name, last_name, phone, email, company_name)
            )
          )
        `)
        .eq('id', body.quote_id)
        .single()

      if (quoteError || !quoteData) {
        throw new Error('Devis introuvable')
      }

      quote = quoteData
      event = quoteData.events
    } else if (body.event_id) {
      const { data: eventData, error: eventError } = await supabaseClient
        .from('events')
        .select(`
          *,
          clients!inner(
            profile_id,
            address,
            city,
            profiles!inner(first_name, last_name, phone, email, company_name)
          ),
          quotes(
            *,
            quote_items(*)
          )
        `)
        .eq('id', body.event_id)
        .single()

      if (eventError || !eventData) {
        throw new Error('Événement introuvable')
      }

      event = eventData
      // Prendre le dernier devis accepté
      quote = eventData.quotes?.find((q: any) => q.status === 'accepted') || null

      if (!quote) {
        throw new Error('Aucun devis accepté trouvé pour cet événement')
      }
    }

    // Générer le numéro de facture
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    
    const { data: lastInvoice } = await supabaseClient
      .from('documents')
      .select('title')
      .like('title', `FAC-${dateStr}-%`)
      .order('title', { ascending: false })
      .limit(1)
      .single()

    let invoiceNumber: string
    if (lastInvoice && lastInvoice.title) {
      const lastNum = parseInt(lastInvoice.title.split('-')[2]) || 0
      invoiceNumber = `FAC-${dateStr}-${String(lastNum + 1).padStart(3, '0')}`
    } else {
      invoiceNumber = `FAC-${dateStr}-001`
    }

    // TODO: Générer le PDF de la facture
    // Utiliser une bibliothèque comme pdfkit, puppeteer, ou un service externe
    // const pdfBuffer = await generateInvoicePDF({
    //   invoiceNumber,
    //   quote,
    //   event,
    //   client: event.clients.profiles,
    // })

    // TODO: Uploader le PDF vers Supabase Storage
    // const { data: uploadData, error: uploadError } = await supabaseClient
    //   .storage
    //   .from('invoices')
    //   .upload(`${invoiceNumber}.pdf`, pdfBuffer, {
    //     contentType: 'application/pdf',
    //   })

    // const pdfUrl = uploadData ? `${SUPABASE_URL}/storage/v1/object/public/invoices/${invoiceNumber}.pdf` : null

    // Pour l'instant, retourner les données sans PDF
    const invoiceData = {
      invoice_number: invoiceNumber,
      quote: quote,
      event: event,
      client: event.clients.profiles,
      generated_at: now.toISOString(),
      pdf_url: null, // Sera rempli une fois le PDF généré
    }

    // Créer un document pour la facture
    const { data: document, error: documentError } = await supabaseClient
      .from('documents')
      .insert({
        event_id: event.id,
        document_type: 'invoice',
        title: invoiceNumber,
        file_url: null, // Sera mis à jour après upload du PDF
      })
      .select()
      .single()

    if (documentError) {
      throw new Error(`Erreur lors de la création du document: ${documentError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invoice: invoiceData,
          document: document,
        },
        message: 'Facture générée avec succès (PDF à implémenter)'
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
        error: error.message || 'Erreur lors de la génération de la facture'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

