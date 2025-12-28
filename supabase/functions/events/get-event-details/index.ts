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
      throw new Error(`Profil introuvable: ${profileError?.message || 'Profil non trouvé pour l\'utilisateur ' + user.id}`)
    }

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')

    if (!eventId) {
      throw new Error('event_id est requis')
    }

    // D'abord vérifier que l'événement existe (requête simple)
    const { data: eventBase, error: eventBaseError } = await supabaseAdmin
      .from('events')
      .select('id, client_id, venue_id, title, event_date, status')
      .eq('id', eventId)
      .single()

    if (eventBaseError || !eventBase) {
      throw new Error(`Événement introuvable: ${eventBaseError?.message || 'Événement non trouvé avec l\'ID ' + eventId}`)
    }

    // Ensuite récupérer toutes les relations séparément pour éviter les problèmes de JOIN
    const [venueResult, clientResult, quotesResult, eventServicesResult] = await Promise.all([
      // Venue
      eventBase.venue_id ? supabaseAdmin
        .from('venues')
        .select('*')
        .eq('id', eventBase.venue_id)
        .single() : Promise.resolve({ data: null, error: null }),
      
      // Client avec profil
      supabaseAdmin
        .from('clients')
        .select(`
          id,
          profile_id,
          address,
          city,
          profiles!inner(
            id,
            first_name,
            last_name,
            phone,
            email,
            avatar_url
          )
        `)
        .eq('id', eventBase.client_id)
        .single(),
      
      // Quotes
      supabaseAdmin
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          validity_date,
          sent_at,
          accepted_at
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      
      // Event services
      supabaseAdmin
        .from('event_services')
        .select(`
          id,
          service_id,
          provider_id,
          configuration,
          quantity,
          unit_price,
          total_price,
          services(name, service_type, description),
          providers(name, email, phone, rating)
        `)
        .eq('event_id', eventId)
    ])

    // Récupérer les quote_items pour chaque quote
    let quotesWithItems = []
    if (quotesResult.data) {
      for (const quote of quotesResult.data) {
        const { data: quoteItems } = await supabaseAdmin
          .from('quote_items')
          .select(`
            id,
            description,
            quantity,
            unit_price,
            total_price,
            event_services(
              service_id,
              services(name, service_type)
            )
          `)
          .eq('quote_id', quote.id)
        
        quotesWithItems.push({
          ...quote,
          quote_items: quoteItems || []
        })
      }
    }

    // Construire l'objet événement complet
    const event = {
      ...eventBase,
      venues: venueResult.data,
      clients: clientResult.data,
      quotes: quotesWithItems,
      event_services: eventServicesResult.data || []
    }

    // Vérifier les permissions (les admins peuvent accéder à tous les événements)
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }
    // Les admins peuvent accéder à tous les événements

    // Compter les invités (utiliser supabaseAdmin)
    const { count: guestCount } = await supabaseAdmin
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)

    // Compter les invités par statut RSVP (utiliser supabaseAdmin)
    const { data: rsvpStats } = await supabaseAdmin
      .from('guests')
      .select('rsvp_status')
      .eq('event_id', eventId)

    const rsvpCounts = {
      pending: 0,
      accepted: 0,
      declined: 0,
      maybe: 0,
    }

    rsvpStats?.forEach((guest) => {
      const status = guest.rsvp_status || 'pending'
      if (rsvpCounts[status] !== undefined) {
        rsvpCounts[status]++
      }
    })

    // Récupérer les paiements (utiliser supabaseAdmin)
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('event_id', eventId)
      .order('due_date', { ascending: true })

    // Calculer les statistiques de paiement
    const paymentStats = {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
    }

    payments?.forEach((payment) => {
      paymentStats.total += payment.amount || 0
      if (payment.status === 'paye') {
        paymentStats.paid += payment.amount || 0
      } else if (payment.status === 'en_attente' || payment.status === 'acompte_recu' || payment.status === 'partiellement_paye') {
        paymentStats.pending += payment.amount || 0
        if (payment.due_date && new Date(payment.due_date) < new Date()) {
          paymentStats.overdue += payment.amount || 0
        }
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...event,
          guest_count_actual: guestCount || 0,
          rsvp_stats: rsvpCounts,
          payments: payments || [],
          payment_stats: paymentStats,
        }
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
        error: error.message || 'Erreur lors de la récupération des détails de l\'événement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

