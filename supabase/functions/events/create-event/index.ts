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

    // Les admins peuvent créer des événements pour n'importe quel client
    // Les clients peuvent créer leurs propres événements
    let clientId = user.id
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      // Si admin, utiliser le client_id fourni dans le body
      if (body.client_id) {
        clientId = body.client_id
      } else {
        // Si pas de client_id fourni, récupérer le premier client disponible
        const { data: clients } = await supabaseAdmin
          .from('clients')
          .select('id, profile_id')
          .limit(1)
        
        if (!clients || clients.length === 0) {
          throw new Error('Aucun client trouvé. Les admins doivent spécifier un client_id dans le body pour créer un événement.')
        }
        clientId = clients[0].profile_id
      }
    } else if (profile.role !== 'client') {
      throw new Error('Seuls les clients et administrateurs peuvent créer des événements')
    }

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
      const { data: venue, error: venueError } = await supabaseAdmin
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
      const { data: availability } = await supabaseAdmin
        .from('venue_availability')
        .select('is_available')
        .eq('venue_id', body.venue_id)
        .eq('date', body.event_date.split('T')[0])
        .single()

      if (availability && !availability.is_available) {
        throw new Error('Le lieu n\'est pas disponible pour cette date')
      }
    }

    // Vérifier que le client existe et récupérer son ID (pas profile_id)
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, profile_id')
      .eq('profile_id', clientId)
      .single()

    if (!client) {
      throw new Error('Profil client introuvable')
    }

    // Créer l'événement
    // Note: client_id doit référencer clients(id), pas clients(profile_id)
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        client_id: client.id,
        event_type: body.event_type,
        event_category: body.event_category || null,
        title: body.title,
        event_date: body.event_date,
        venue_id: body.venue_id || null,
        guest_count: body.guest_count || null,
        status: 'planification', // Par défaut, événement en planification
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

    // Créer une notification pour l'admin (seulement si créé par un client)
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: null, // Notification pour tous les admins
          event_id: event.id,
          type: 'event_created',
          title: 'Nouvel événement créé',
          message: `Un nouvel événement "${body.title}" a été créé`,
          is_read: false,
        })
    }

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

