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

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const rsvpStatus = url.searchParams.get('rsvp_status')
    const category = url.searchParams.get('category')

    if (!eventId) {
      throw new Error('event_id est requis')
    }

    // Vérifier que l'événement existe (utiliser supabaseAdmin pour éviter RLS)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || event.client_id !== client.id) {
        // Les admins peuvent accéder à tous les événements
        throw new Error('Accès non autorisé à cet événement')
      }
    }

    // Construire la requête (utiliser supabaseAdmin pour éviter RLS)
    let query = supabaseAdmin
      .from('guests')
      .select('*')
      .eq('event_id', eventId)

    // Appliquer les filtres
    if (rsvpStatus) {
      query = query.eq('rsvp_status', rsvpStatus)
    }

    if (category) {
      query = query.eq('category', category)
    }

    // Trier par nom
    query = query.order('last_name', { ascending: true }).order('first_name', { ascending: true })

    // Exécuter la requête
    const { data: guests, error: guestsError } = await query

    if (guestsError) {
      throw new Error(`Erreur lors de la récupération des invités: ${guestsError.message}`)
    }

    // Calculer les statistiques RSVP
    const stats = {
      total: guests?.length || 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      maybe: 0,
    }

    guests?.forEach((guest) => {
      const status = guest.rsvp_status || 'pending'
      if (stats[status] !== undefined) {
        stats[status]++
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          guests: guests || [],
          stats: stats,
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
        error: error.message || 'Erreur lors de la récupération de la liste des invités'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

