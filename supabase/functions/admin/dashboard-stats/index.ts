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

    // Utiliser la vue admin_dashboard_stats
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('admin_dashboard_stats')
      .select('*')
      .single()

    if (statsError) {
      // Si la vue n'existe pas, calculer manuellement
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, status, event_date', { count: 'exact' })

      const { data: quotes } = await supabaseAdmin
        .from('quotes')
        .select('id, status', { count: 'exact' })

      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('amount, status', { count: 'exact' })

      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('id', { count: 'exact' })

      const totalEvents = events?.length || 0
      const upcomingEvents = events?.filter(e => new Date(e.event_date) >= new Date()).length || 0
      const completedEvents = events?.filter(e => e.status === 'termine').length || 0
      const totalQuotes = quotes?.length || 0
      const pendingQuotes = quotes?.filter(q => q.status === 'en_attente').length || 0
      const acceptedQuotes = quotes?.filter(q => q.status === 'accepte').length || 0
      const totalRevenue = payments?.filter(p => p.status === 'paye').reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const totalClients = clients?.length || 0

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_events: totalEvents,
            upcoming_events: upcomingEvents,
            completed_events: completedEvents,
            total_quotes: totalQuotes,
            pending_quotes: pendingQuotes,
            accepted_quotes: acceptedQuotes,
            total_revenue: totalRevenue,
            total_clients: totalClients,
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

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
