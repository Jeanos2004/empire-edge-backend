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

    // Seuls les admins peuvent supprimer des utilisateurs
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.user_id) {
      throw new Error('user_id est requis')
    }

    // Ne pas permettre de se supprimer soi-même
    if (body.user_id === user.id) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte')
    }

    // Vérifier que l'utilisateur existe
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', body.user_id)
      .single()

    if (!existingProfile) {
      throw new Error('Utilisateur introuvable')
    }

    // Ne pas permettre de supprimer un super_admin (sauf si on est soi-même super_admin)
    if (existingProfile.role === 'super_admin' && profile.role !== 'super_admin') {
      throw new Error('Seuls les super administrateurs peuvent supprimer un super administrateur')
    }

    // Vérifier s'il y a des événements associés
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('profile_id', body.user_id)
      .single()

    if (client) {
      const { count: eventsCount } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)

      if (eventsCount && eventsCount > 0) {
        // Optionnel : demander confirmation ou empêcher la suppression
        // Pour l'instant, on supprime quand même (cascade)
      }
    }

    // Supprimer l'utilisateur (cascade sur profiles et clients)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.user_id)

    if (deleteError) {
      throw new Error(`Erreur lors de la suppression de l'utilisateur: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Utilisateur supprimé avec succès'
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
        error: error.message || 'Erreur lors de la suppression de l\'utilisateur'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

