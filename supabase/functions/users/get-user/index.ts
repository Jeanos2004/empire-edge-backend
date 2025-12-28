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
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
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
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      throw new Error('user_id est requis')
    }

    // Les admins peuvent voir tous les utilisateurs, les clients peuvent voir uniquement leur propre profil
    if (profile.role !== 'admin' && profile.role !== 'super_admin' && userId !== user.id) {
      throw new Error('Accès non autorisé')
    }

    // Récupérer le profil complet (utiliser supabaseAdmin pour éviter RLS)
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        clients(*)
      `)
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      throw new Error(`Utilisateur introuvable: ${userError?.message || 'Utilisateur non trouvé'}`)
    }

    // Récupérer les informations de l'utilisateur depuis Auth (admin uniquement)
    let authUser = null
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authUserData?.user) {
        authUser = {
          id: authUserData.user.id,
          email: authUserData.user.email,
          email_confirmed_at: authUserData.user.email_confirmed_at,
          created_at: authUserData.user.created_at,
          last_sign_in_at: authUserData.user.last_sign_in_at,
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          profile: userProfile,
          auth: authUser,
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
        error: error.message || 'Erreur lors de la récupération de l\'utilisateur'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

