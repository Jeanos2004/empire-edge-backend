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
    // Utiliser supabaseAdmin pour éviter les problèmes RLS
    // Cette fonction est publique (vérification de disponibilité)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parser les query params
    const url = new URL(req.url)
    const venueId = url.searchParams.get('venue_id')
    const date = url.searchParams.get('date')

    if (!venueId) {
      throw new Error('venue_id est requis')
    }

    if (!date) {
      throw new Error('date est requise')
    }

    // Vérifier que le lieu existe (utiliser supabaseAdmin)
    const { data: venue, error: venueError } = await supabaseAdmin
      .from('venues')
      .select('id, name, is_available, capacity_max')
      .eq('id', venueId)
      .single()

    if (venueError || !venue) {
      throw new Error(`Lieu introuvable: ${venueError?.message || 'Lieu non trouvé avec l\'ID ' + venueId}`)
    }

    // Vérifier la disponibilité générale
    if (!venue.is_available) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            venue_id: venueId,
            date: date,
            is_available: false,
            reason: 'Le lieu n\'est pas disponible actuellement'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Vérifier la disponibilité pour la date spécifique (utiliser supabaseAdmin)
    const dateOnly = date.split('T')[0]
    const { data: availability, error: availabilityError } = await supabaseAdmin
      .from('venue_availability')
      .select('is_available')
      .eq('venue_id', venueId)
      .eq('date', dateOnly)
      .maybeSingle()

    // Si pas d'entrée dans venue_availability, le lieu est disponible par défaut
    let isAvailable = true
    if (availability) {
      isAvailable = availability.is_available
    }

    // Vérifier si le lieu est déjà réservé pour cette date via un événement (utiliser supabaseAdmin)
    const { data: existingEvent } = await supabaseAdmin
      .from('events')
      .select('id, title')
      .eq('venue_id', venueId)
      .eq('event_date', dateOnly)
      .maybeSingle()

    if (existingEvent) {
      isAvailable = false
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          venue_id: venueId,
          venue_name: venue.name,
          date: dateOnly,
          is_available: isAvailable,
          capacity_max: venue.capacity_max,
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
        error: error.message || 'Erreur lors de la vérification de la disponibilité'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

