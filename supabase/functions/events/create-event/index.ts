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

    // Récupérer le profil pour vérifier que c'est un client
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role, clients!inner(profile_id)')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'client') {
      throw new Error('Seuls les clients peuvent créer des événements')
    }

    // Parser le body
    const body = await req.json()

    // Validation des données requises
    if (!body.event_type) {
      throw new Error('Le type d\'événement est requis')
    }

    if (!body.title) {
      throw new Error('Le titre est requis')
    }

    if (!body.event_date) {
      throw new Error('La date de l\'événement est requise')
    }

    // Validation de la date (doit être dans le futur)
    const eventDate = new Date(body.event_date)
    const now = new Date()
    if (eventDate <= now) {
      throw new Error('La date de l\'événement doit être dans le futur')
    }

    // Validation du nombre d'invités
    if (body.guest_count && typeof body.guest_count !== 'number') {
      throw new Error('Le nombre d\'invités doit être un nombre')
    }

    if (body.guest_count && body.guest_count < 1) {
      throw new Error('Le nombre d\'invités doit être supérieur à 0')
    }

    // Validation du budget
    if (body.budget_min && body.budget_max) {
      if (body.budget_min > body.budget_max) {
        throw new Error('Le budget minimum ne peut pas être supérieur au budget maximum')
      }
    }

    // Vérifier la disponibilité du lieu si un venue_id est fourni
    if (body.venue_id) {
      const { data: venue, error: venueError } = await supabaseClient
        .from('venues')
        .select('capacity_max, is_available')
        .eq('id', body.venue_id)
        .single()

      if (venueError || !venue) {
        throw new Error('Lieu introuvable')
      }

      if (!venue.is_available) {
        throw new Error('Le lieu n\'est pas disponible')
      }

      // Vérifier la capacité
      if (body.guest_count && venue.capacity_max && body.guest_count > venue.capacity_max) {
        throw new Error(`Le nombre d'invités dépasse la capacité maximale du lieu (${venue.capacity_max})`)
      }

      // Vérifier la disponibilité pour la date
      const { data: availability } = await supabaseClient
        .from('venue_availability')
        .select('is_available')
        .eq('venue_id', body.venue_id)
        .eq('date', body.event_date.split('T')[0])
        .single()

      if (availability && !availability.is_available) {
        throw new Error('Le lieu n\'est pas disponible pour cette date')
      }
    }

    // Récupérer le client_id
    const { data: client } = await supabaseClient
      .from('clients')
      .select('profile_id')
      .eq('profile_id', user.id)
      .single()

    if (!client) {
      throw new Error('Profil client introuvable')
    }

    // Créer l'événement
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .insert({
        client_id: client.profile_id,
        event_type: body.event_type,
        event_category: body.event_category || null,
        title: body.title,
        event_date: body.event_date,
        venue_id: body.venue_id || null,
        guest_count: body.guest_count || null,
        status: 'draft', // Par défaut, événement en brouillon
        budget_min: body.budget_min || null,
        budget_max: body.budget_max || null,
        style: body.style || null,
        is_hybrid: body.is_hybrid || false,
      })
      .select()
      .single()

    if (eventError) {
      throw new Error(`Erreur lors de la création de l'événement: ${eventError.message}`)
    }

    // Créer une notification pour l'admin
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: null, // Notification pour tous les admins
        event_id: event.id,
        type: 'event_created',
        title: 'Nouvel événement créé',
        message: `Un nouvel événement "${body.title}" a été créé`,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: true,
        data: event,
        message: 'Événement créé avec succès'
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
        error: error.message || 'Erreur lors de la création de l\'événement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

