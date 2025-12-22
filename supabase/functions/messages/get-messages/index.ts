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

    // Parser les query params
    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const otherUserId = url.searchParams.get('other_user_id')
    const isRead = url.searchParams.get('is_read')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Construire la requête pour récupérer les messages où l'utilisateur est expéditeur ou destinataire
    let query = supabaseClient
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, first_name, last_name, avatar_url),
        recipient:profiles!messages_recipient_id_fkey(id, first_name, last_name, avatar_url),
        events(id, title)
      `, { count: 'exact' })

    // Filtrer les messages de l'utilisateur
    query = query.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)

    // Appliquer les filtres
    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    if (otherUserId) {
      // Filtrer pour une conversation spécifique
      query = query.or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    }

    if (isRead !== null) {
      query = query.eq('is_read', isRead === 'true')
    }

    // Trier par date (plus récent en premier)
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    // Exécuter la requête
    const { data: messages, error, count } = await query

    if (error) {
      throw new Error(`Erreur lors de la récupération des messages: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: messages || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
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
        error: error.message || 'Erreur lors de la récupération des messages'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

