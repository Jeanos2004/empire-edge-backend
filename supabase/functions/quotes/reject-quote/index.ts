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

    // Parser le body
    const body = await req.json()

    if (!body.quote_id) {
      throw new Error('quote_id est requis')
    }

    // Vérifier que le devis existe
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select(`
        *,
        events(
          id,
          client_id
        )
      `)
      .eq('id', body.quote_id)
      .single()

    if (quoteError || !quote) {
      throw new Error('Devis introuvable')
    }

    // Vérifier les permissions (seul le client propriétaire peut rejeter)
    if (profile.role === 'client') {
      const { data: client } = await supabaseClient
        .from('clients')
        .select('profile_id')
        .eq('profile_id', user.id)
        .single()

      if (!client || quote.events.client_id !== client.profile_id) {
        throw new Error('Accès non autorisé à ce devis')
      }
    }

    // Vérifier que le devis peut être rejeté
    if (quote.status === 'accepted') {
      throw new Error('Impossible de rejeter un devis déjà accepté')
    }

    if (quote.status === 'rejected') {
      throw new Error('Ce devis a déjà été rejeté')
    }

    // Mettre à jour le devis
    const { data: updatedQuote, error: updateError } = await supabaseClient
      .from('quotes')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: body.reason || null,
      })
      .eq('id', body.quote_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors du rejet du devis: ${updateError.message}`)
    }

    // Créer une notification pour l'admin
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: null, // Notification pour tous les admins
        event_id: quote.events.id,
        type: 'quote_rejected',
        title: 'Devis rejeté',
        message: `Le devis ${quote.quote_number} a été rejeté${body.reason ? `: ${body.reason}` : ''}`,
        is_read: false,
      })

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedQuote,
        message: 'Devis rejeté avec succès'
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
        error: error.message || 'Erreur lors du rejet du devis'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

