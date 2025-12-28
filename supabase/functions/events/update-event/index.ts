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

    // Vérifier que l'événement existe et les permissions
    const { data: existingEvent, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('client_id, status')
      .eq('id', body.event_id)
      .single()

    if (fetchError || !existingEvent) {
      throw new Error('Événement introuvable')
    }

    // Créer un client avec service role pour éviter les problèmes RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier les permissions
    if (profile.role === 'client') {
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || existingEvent.client_id !== client.profile_id) {
        // Les admins peuvent modifier tous les événements
        throw new Error('Accès non autorisé à cet événement')
      }
    }
    // Les admins peuvent modifier tous les événements

    // Vérifier si l'événement peut être modifié (pas de devis accepté)
    if (existingEvent.status === 'termine' || existingEvent.status === 'annule') {
      throw new Error('Impossible de modifier un événement terminé ou annulé')
    }

    // Préparer les données de mise à jour
    const updates: any = {}
    if (body.event_type !== undefined) updates.event_type = body.event_type
    if (body.event_category !== undefined) updates.event_category = body.event_category
    if (body.title !== undefined) updates.title = body.title
    if (body.event_date !== undefined) {
      // Validation de la date
      const eventDate = new Date(body.event_date)
      const now = new Date()
      if (eventDate <= now) {
        throw new Error('La date de l\'événement doit être dans le futur')
      }
      updates.event_date = body.event_date
    }
    if (body.venue_id !== undefined) {
      // Vérifier la disponibilité du nouveau lieu si fourni
      if (body.venue_id) {
        const { data: venue } = await supabaseClient
          .from('venues')
          .select('capacity_max, is_available')
          .eq('id', body.venue_id)
          .single()

        if (!venue || !venue.is_available) {
          throw new Error('Le lieu n\'est pas disponible')
        }

        if (body.guest_count && venue.capacity_max && body.guest_count > venue.capacity_max) {
          throw new Error(`Le nombre d'invités dépasse la capacité maximale du lieu`)
        }
      }
      updates.venue_id = body.venue_id
    }
    if (body.guest_count !== undefined) updates.guest_count = body.guest_count
    if (body.status !== undefined) {
      // Validation du statut (valeurs selon le schéma SQL)
      const validStatuses = ['planification', 'confirme', 'en_preparation', 'en_cours', 'termine', 'annule']
      if (!validStatuses.includes(body.status)) {
        throw new Error(`Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}`)
      }
      // Seuls les admins peuvent changer certains statuts
      if (['termine', 'annule'].includes(body.status) && profile.role !== 'admin' && profile.role !== 'super_admin') {
        throw new Error('Seuls les administrateurs peuvent définir ce statut')
      }
      updates.status = body.status
    }
    if (body.budget_min !== undefined) updates.budget_min = body.budget_min
    if (body.budget_max !== undefined) updates.budget_max = body.budget_max
    if (body.style !== undefined) updates.style = body.style
    if (body.is_hybrid !== undefined) updates.is_hybrid = body.is_hybrid

    // Validation du budget
    if (updates.budget_min && updates.budget_max && updates.budget_min > updates.budget_max) {
      throw new Error('Le budget minimum ne peut pas être supérieur au budget maximum')
    }

    // Mettre à jour l'événement
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updates)
      .eq('id', body.event_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedEvent,
        message: 'Événement mis à jour avec succès'
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
        error: error.message || 'Erreur lors de la mise à jour de l\'événement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

