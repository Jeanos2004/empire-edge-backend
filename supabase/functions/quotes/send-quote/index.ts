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

    // Seuls les admins peuvent envoyer des devis
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
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
          clients!inner(
            profile_id,
            profiles!inner(email, first_name, last_name)
          )
        )
      `)
      .eq('id', body.quote_id)
      .single()

    if (quoteError || !quote) {
      throw new Error('Devis introuvable')
    }

    // Vérifier que le devis n'a pas déjà été envoyé
    if (quote.sent_at) {
      throw new Error('Ce devis a déjà été envoyé')
    }

    // Vérifier que le devis n'est pas déjà accepté ou rejeté
    if (quote.status === 'accepted' || quote.status === 'rejected') {
      throw new Error(`Impossible d'envoyer un devis avec le statut: ${quote.status}`)
    }

    // Mettre à jour le devis
    const { data: updatedQuote, error: updateError } = await supabaseClient
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', body.quote_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de l'envoi du devis: ${updateError.message}`)
    }

    // Créer une notification pour le client
    const clientProfile = quote.events?.clients?.profiles
    if (clientProfile) {
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: quote.events.client_id,
          event_id: quote.events.id,
          type: 'quote_sent',
          title: 'Nouveau devis reçu',
          message: `Un nouveau devis (${quote.quote_number}) a été envoyé pour votre événement`,
          is_read: false,
        })

      // TODO: Envoyer un email au client avec le devis en PDF
      // Utiliser un service d'email (Resend, SendGrid, etc.)
      // const emailContent = generateQuoteEmail(updatedQuote)
      // await sendEmail(clientProfile.email, 'Nouveau devis Empire Events', emailContent)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedQuote,
        message: 'Devis envoyé avec succès'
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
        error: error.message || 'Erreur lors de l\'envoi du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

