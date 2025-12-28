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
    // Créer client Supabase avec anon key pour l'authentification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parser le body
    const body = await req.json()

    // Validation des données
    if (!body.email || !body.password) {
      throw new Error('Email et mot de passe sont requis')
    }

    // Authentifier l'utilisateur
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (authError) {
      throw new Error(`Erreur d'authentification: ${authError.message}`)
    }

    if (!authData.user || !authData.session) {
      throw new Error('Échec de l\'authentification')
    }

    // Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer le profil complet avec client (en utilisant service role pour éviter RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        clients(*)
      `)
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: authData.user,
          session: authData.session,
          profile: profile,
        },
        message: 'Connexion réussie'
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
        error: error.message || 'Erreur lors de la connexion'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      },
    )
  }
})

