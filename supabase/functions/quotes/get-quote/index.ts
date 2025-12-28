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
    const quoteId = url.searchParams.get('quote_id')
    const eventId = url.searchParams.get('event_id')

    if (!quoteId && !eventId) {
      throw new Error('quote_id ou event_id est requis')
    }

    // D'abord récupérer le(s) devis de base (requête simple)
    let quotesBase: any[] = []
    
    if (quoteId) {
      const { data: quoteBase, error: quoteBaseError } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single()

      if (quoteBaseError || !quoteBase) {
        throw new Error(`Devis introuvable: ${quoteBaseError?.message || 'Devis non trouvé avec l\'ID ' + quoteId}`)
      }
      quotesBase = [quoteBase]
    } else {
      const { data: quotesData, error: quotesError } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (quotesError) {
        throw new Error(`Erreur lors de la récupération des devis: ${quotesError.message}`)
      }
      quotesBase = quotesData || []
    }

    if (quotesBase.length === 0) {
      throw new Error('Aucun devis trouvé')
    }

    // Vérifier les permissions AVANT de récupérer les relations
    // Les admins peuvent voir tous les devis, les clients seulement leurs devis
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable pour cet utilisateur')
      }

      // Récupérer les événements pour vérifier les permissions
      const eventIds = [...new Set(quotesBase.map(q => q.event_id))]
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, client_id')
        .in('id', eventIds)

      // Filtrer les devis selon les permissions
      const filteredQuotes = quotesBase.filter((quote: any) => {
        const event = events?.find(e => e.id === quote.event_id)
        if (!event) {
          return false
        }
        // Vérifier que l'événement appartient au client
        return event.client_id === client.id
      })

      if (filteredQuotes.length === 0) {
        // Message d'erreur détaillé pour le débogage
        const quoteEventId = quotesBase[0]?.event_id
        
        if (quoteEventId) {
          // Récupérer les détails de l'événement et du propriétaire
          const { data: eventOwner } = await supabaseAdmin
            .from('events')
            .select(`
              id,
              title,
              client_id
            `)
            .eq('id', quoteEventId)
            .single()
          
          if (eventOwner) {
            // Récupérer le client propriétaire
            const { data: ownerClient } = await supabaseAdmin
              .from('clients')
              .select(`
                id,
                profile_id,
                profiles!inner(id, first_name, last_name)
              `)
              .eq('id', eventOwner.client_id)
              .single()
            
            const ownerName = ownerClient?.profiles ? 
              `${ownerClient.profiles.first_name} ${ownerClient.profiles.last_name}` : 
              'Inconnu'
            
            throw new Error(`Devis introuvable ou accès non autorisé. Ce devis appartient à l'événement "${eventOwner.title}" (ID: ${eventOwner.id}) qui est la propriété de ${ownerName} (Client ID: ${eventOwner.client_id}). Votre Client ID: ${client.id} (Profile ID: ${client.profile_id}).`)
          }
        }
        
        const eventIds = [...new Set(quotesBase.map(q => q.event_id))]
        const eventDetails = events?.map(e => `event_id=${e.id}, client_id=${e.client_id}`).join('; ') || 'aucun événement trouvé'
        throw new Error(`Devis introuvable ou accès non autorisé. Votre Client ID: ${client.id}, Event IDs recherchés: ${eventIds.join(', ')}, Événements trouvés: ${eventDetails}.`)
      }

      quotesBase = filteredQuotes
    }
    // Si c'est un admin, il peut voir tous les devis (pas de filtrage)

    // Maintenant récupérer toutes les relations pour chaque devis
    const quotesWithRelations = await Promise.all(quotesBase.map(async (quote) => {
      const [eventResult, quoteItemsResult, contractsResult] = await Promise.all([
        // Événement avec client et profil
        supabaseAdmin
          .from('events')
          .select(`
            id,
            title,
            event_date,
            client_id,
            clients!inner(
              id,
              profile_id,
              profiles!inner(id, first_name, last_name, phone)
            )
          `)
          .eq('id', quote.event_id)
          .single(),
        
        // Quote items
        supabaseAdmin
          .from('quote_items')
          .select(`
            id,
            event_service_id,
            description,
            quantity,
            unit_price,
            total_price,
            event_services(
              service_id,
              services(name, service_type)
            )
          `)
          .eq('quote_id', quote.id),
        
        // Contrats
        supabaseAdmin
          .from('contracts')
          .select('id, contract_number, signed_at')
          .eq('quote_id', quote.id)
      ])

      return {
        ...quote,
        events: eventResult.data,
        quote_items: quoteItemsResult.data || [],
        contracts: contractsResult.data || []
      }
    }))

    const result = quoteId ? quotesWithRelations[0] : quotesWithRelations

    return new Response(
      JSON.stringify({
        success: true,
        data: result
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
        error: error.message || 'Erreur lors de la récupération du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

