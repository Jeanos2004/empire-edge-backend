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

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')

    if (!eventId) {
      throw new Error('event_id est requis')
    }

    // Récupérer l'événement avec toutes les relations
    let query = supabaseClient
      .from('events')
      .select(`
        *,
        venues(*),
        clients!inner(
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
        ),
        quotes(
          id,
          quote_number,
          status,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          validity_date,
          sent_at,
          accepted_at,
          quote_items(
            id,
            description,
            quantity,
            unit_price,
            total_price,
            event_services(
              service_id,
              services(name, service_type)
            )
          )
        ),
        event_services(
          id,
          service_id,
          provider_id,
          configuration,
          quantity,
          unit_price,
          total_price,
          services(name, service_type, description),
          providers(name, email, phone, rating)
        )
      `)
      .eq('id', eventId)
      .single()

    const { data: event, error: eventError } = await query

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

    // Compter les invités
    const { count: guestCount } = await supabaseClient
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)

    // Compter les invités par statut RSVP
    const { data: rsvpStats } = await supabaseClient
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

    // Récupérer les paiements
    const { data: payments } = await supabaseClient
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
      if (payment.status === 'paid') {
        paymentStats.paid += payment.amount || 0
      } else if (payment.status === 'pending') {
        paymentStats.pending += payment.amount || 0
        if (new Date(payment.due_date) < new Date()) {
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

