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

    if (profileError) {
      throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`)
    }

    if (!profile) {
      throw new Error(`Profil introuvable pour l'utilisateur ${user.id}. Assurez-vous que le profil existe dans la table profiles.`)
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

    // Vérifier que le devis existe (utiliser supabaseAdmin pour éviter RLS)
    // D'abord récupérer le devis de base
    const { data: quoteBase, error: quoteBaseError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', body.quote_id)
      .single()

    if (quoteBaseError || !quoteBase) {
      throw new Error(`Devis introuvable: ${quoteBaseError?.message || 'Devis non trouvé avec l\'ID ' + body.quote_id}`)
    }

    // Ensuite récupérer l'événement
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_id')
      .eq('id', quoteBase.event_id)
      .single()

    if (eventError || !event) {
      throw new Error(`Événement introuvable pour le devis: ${eventError?.message || 'Événement non trouvé'}`)
    }

    // Récupérer le client et son profil
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        profile_id,
        profiles!inner(email, first_name, last_name)
      `)
      .eq('id', event.client_id)
      .single()

    // Combiner les données
    const quote = {
      ...quoteBase,
      events: {
        ...event,
        clients: client ? {
          ...client,
          profiles: client.profiles
        } : null
      }
    }

    // Vérifier que le devis n'a pas déjà été envoyé
    if (quote.sent_at) {
      throw new Error('Ce devis a déjà été envoyé')
    }

    // Vérifier que le devis n'est pas déjà accepté ou rejeté
    if (quote.status === 'accepte' || quote.status === 'refuse') {
      throw new Error(`Impossible d'envoyer un devis avec le statut: ${quote.status}`)
    }

    // Mettre à jour le devis (utiliser supabaseAdmin pour éviter RLS)
    const { data: updatedQuote, error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({
        status: 'envoye',
        sent_at: new Date().toISOString(),
      })
      .eq('id', body.quote_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de l'envoi du devis: ${updateError.message}`)
    }

    // Créer une notification pour le client (utiliser supabaseAdmin)
    const clientProfile = quote.events?.clients?.profiles
    if (clientProfile) {
      // Récupérer le profile_id du client pour la notification
      const clientProfileId = quote.events.clients.profile_id
      if (clientProfileId) {
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: clientProfileId,
            event_id: quote.events.id,
            type: 'quote_sent',
            title: 'Nouveau devis reçu',
            message: `Un nouveau devis (${quote.quote_number}) a été envoyé pour votre événement`,
            is_read: false,
          })
      }

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

