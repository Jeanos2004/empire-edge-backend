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

    // Seuls les admins peuvent accéder aux stats
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser les query params pour la période
    const url = new URL(req.url)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    // Construire les filtres de date
    let dateFilter = {}
    if (startDate) {
      dateFilter = { ...dateFilter, gte: startDate }
    }
    if (endDate) {
      dateFilter = { ...dateFilter, lte: endDate }
    }

    // Récupérer les statistiques
    const stats: any = {}

    // Nombre total d'événements
    let eventsQuery = supabaseClient.from('events').select('*', { count: 'exact', head: true })
    if (startDate || endDate) {
      eventsQuery = eventsQuery.gte('created_at', startDate || '1900-01-01').lte('created_at', endDate || '2100-12-31')
    }
    const { count: totalEvents } = await eventsQuery

    // Événements par statut
    const { data: eventsByStatus } = await supabaseClient
      .from('events')
      .select('status')
    
    const statusCounts: any = {}
    eventsByStatus?.forEach((event: any) => {
      statusCounts[event.status] = (statusCounts[event.status] || 0) + 1
    })

    // Nombre total de clients
    const { count: totalClients } = await supabaseClient
      .from('clients')
      .select('*', { count: 'exact', head: true })

    // Nombre total de devis
    let quotesQuery = supabaseClient.from('quotes').select('*', { count: 'exact', head: true })
    if (startDate || endDate) {
      quotesQuery = quotesQuery.gte('created_at', startDate || '1900-01-01').lte('created_at', endDate || '2100-12-31')
    }
    const { count: totalQuotes } = await quotesQuery

    // Devis par statut
    const { data: quotesByStatus } = await supabaseClient
      .from('quotes')
      .select('status')
    
    const quoteStatusCounts: any = {}
    quotesByStatus?.forEach((quote: any) => {
      quoteStatusCounts[quote.status] = (quoteStatusCounts[quote.status] || 0) + 1
    })

    // Revenus (paiements payés)
    const { data: payments } = await supabaseClient
      .from('payments')
      .select('amount')
      .eq('status', 'paid')
    
    if (startDate || endDate) {
      // Filtrer par date de paiement
      // Note: Cette logique devrait être ajustée selon votre schéma
    }

    const totalRevenue = payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0

    // Paiements en attente
    const { data: pendingPayments } = await supabaseClient
      .from('payments')
      .select('amount')
      .eq('status', 'pending')
    
    const pendingRevenue = pendingPayments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0

    // Événements à venir (prochains 30 jours)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const { count: upcomingEvents } = await supabaseClient
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('event_date', new Date().toISOString())
      .lte('event_date', thirtyDaysFromNow.toISOString())

    stats.total_events = totalEvents || 0
    stats.events_by_status = statusCounts
    stats.total_clients = totalClients || 0
    stats.total_quotes = totalQuotes || 0
    stats.quotes_by_status = quoteStatusCounts
    stats.total_revenue = totalRevenue
    stats.pending_revenue = pendingRevenue
    stats.upcoming_events = upcomingEvents || 0

    return new Response(
      JSON.stringify({
        success: true,
        data: stats
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
        error: error.message || 'Erreur lors de la récupération des statistiques'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

