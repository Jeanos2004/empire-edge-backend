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
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Parser le body
    const body = await req.json()

    if (!body.event_id) {
      throw new Error('event_id est requis')
    }

    if (!body.venue_id) {
      throw new Error('venue_id est requis')
    }

    // Vérifier que l'événement existe (utiliser supabaseAdmin pour éviter RLS)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_id, venue_id, event_date, guest_count, start_time, end_time, title')
      .eq('id', body.event_id)
      .single()

    if (eventError || !event) {
      throw new Error('Événement introuvable')
    }

    // Vérifier les permissions (les admins peuvent réserver pour tous les événements)
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à cet événement')
      }
    }
    // Les admins peuvent réserver pour tous les événements

    // Utiliser la date de l'événement (event_date est un DATE dans le schéma)
    const reservationDate = event.event_date

    // Vérifier que le lieu existe et est disponible
    const { data: venue, error: venueError } = await supabaseAdmin
      .from('venues')
      .select('id, name, is_available, capacity_max')
      .eq('id', body.venue_id)
      .single()

    if (venueError || !venue) {
      throw new Error('Lieu introuvable')
    }

    if (!venue.is_available) {
      throw new Error('Le lieu n\'est pas disponible')
    }

    // Vérifier la capacité
    if (event.guest_count && venue.capacity_max && event.guest_count > venue.capacity_max) {
      throw new Error(`Le nombre d'invités dépasse la capacité maximale du lieu (${venue.capacity_max})`)
    }

    // Vérifier la disponibilité pour la date
    const { data: availability } = await supabaseAdmin
      .from('venue_availability')
      .select('is_available')
      .eq('venue_id', body.venue_id)
      .eq('date', reservationDate)
      .single()

    if (availability && !availability.is_available) {
      throw new Error('Le lieu n\'est pas disponible pour cette date')
    }

    // Vérifier si le lieu est déjà réservé pour cette date
    const { data: existingEvent } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('venue_id', body.venue_id)
      .eq('event_date', reservationDate)
      .neq('id', body.event_id)
      .limit(1)
      .single()

    if (existingEvent) {
      throw new Error('Le lieu est déjà réservé pour cette date')
    }

    // Mettre à jour l'événement avec le venue_id (utiliser supabaseAdmin)
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update({
        venue_id: body.venue_id,
      })
      .eq('id', body.event_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la réservation: ${updateError.message}`)
    }

    // Créer ou mettre à jour l'entrée venue_availability (utiliser supabaseAdmin)
    const { error: availabilityError } = await supabaseAdmin
      .from('venue_availability')
      .upsert({
        venue_id: body.venue_id,
        date: reservationDate,
        is_available: false,
        reason: `Réservé pour l'événement: ${event.title || body.event_id}`
      }, {
        onConflict: 'venue_id,date'
      })

    if (availabilityError) {
      throw new Error(`Erreur lors de la mise à jour de la disponibilité: ${availabilityError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          event: updatedEvent,
          venue: venue,
          reservation_date: reservationDate,
        },
        message: 'Lieu réservé avec succès'
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
        error: error.message || 'Erreur lors de la réservation du lieu'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
