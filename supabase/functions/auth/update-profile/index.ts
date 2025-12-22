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

    // Parser le body
    const body = await req.json()

    // Préparer les données de mise à jour du profil
    const profileUpdates: any = {}
    if (body.first_name !== undefined) profileUpdates.first_name = body.first_name
    if (body.last_name !== undefined) profileUpdates.last_name = body.last_name
    if (body.phone !== undefined) profileUpdates.phone = body.phone
    if (body.company_name !== undefined) profileUpdates.company_name = body.company_name
    if (body.avatar_url !== undefined) profileUpdates.avatar_url = body.avatar_url

    // Mettre à jour le profil
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id)

    if (profileError) {
      throw new Error(`Erreur lors de la mise à jour du profil: ${profileError.message}`)
    }

    // Préparer les données de mise à jour du client (si l'utilisateur est un client)
    const clientUpdates: any = {}
    if (body.address !== undefined) clientUpdates.address = body.address
    if (body.city !== undefined) clientUpdates.city = body.city
    if (body.preferences !== undefined) clientUpdates.preferences = body.preferences
    if (body.notes !== undefined) clientUpdates.notes = body.notes

    // Mettre à jour les infos client si des données sont fournies
    if (Object.keys(clientUpdates).length > 0) {
      const { error: clientError } = await supabaseClient
        .from('clients')
        .update(clientUpdates)
        .eq('profile_id', user.id)

      if (clientError) {
        throw new Error(`Erreur lors de la mise à jour du client: ${clientError.message}`)
      }
    }

    // Mettre à jour l'email dans Auth si fourni
    if (body.email) {
      const { error: emailError } = await supabaseClient.auth.updateUser({
        email: body.email
      })

      if (emailError) {
        throw new Error(`Erreur lors de la mise à jour de l'email: ${emailError.message}`)
      }
    }

    // Récupérer le profil mis à jour
    const { data: profile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select(`
        *,
        clients(*)
      `)
      .eq('id', user.id)
      .single()

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération du profil: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: profile,
        message: 'Profil mis à jour avec succès'
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
        error: error.message || 'Erreur lors de la mise à jour du profil'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

