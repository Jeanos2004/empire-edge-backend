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
    // Créer client Supabase avec service role pour créer l'utilisateur
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parser le body
    const body = await req.json()

    // Validation des données
    if (!body.email || !body.password) {
      throw new Error('Email et mot de passe sont requis')
    }

    if (!body.first_name || !body.last_name) {
      throw new Error('Prénom et nom sont requis')
    }

    if (!body.phone) {
      throw new Error('Numéro de téléphone est requis')
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      throw new Error('Format email invalide')
    }

    // Validation mot de passe (minimum 6 caractères)
    if (body.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères')
    }

    // Créer l'utilisateur dans Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirmer l'email
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
      }
    })

    if (authError) {
      throw new Error(`Erreur lors de la création de l'utilisateur: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('Échec de la création de l\'utilisateur')
    }

    // Créer le profil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'client', // Par défaut, les nouveaux utilisateurs sont des clients
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        company_name: body.company_name || null,
        avatar_url: body.avatar_url || null,
      })

    if (profileError) {
      // Rollback: supprimer l'utilisateur créé si le profil échoue
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Erreur lors de la création du profil: ${profileError.message}`)
    }

    // Créer l'entrée client
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        profile_id: authData.user.id,
        address: body.address || null,
        city: body.city || null,
        preferences: body.preferences || {},
        notes: body.notes || null,
      })

    if (clientError) {
      // Rollback: supprimer profil et utilisateur
      await supabaseAdmin.from('profiles').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Erreur lors de la création du client: ${clientError.message}`)
    }

    // Récupérer le profil complet avec client
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        clients(*)
      `)
      .eq('id', authData.user.id)
      .single()

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération du profil: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: authData.user,
          profile: profile,
        },
        message: 'Inscription réussie'
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
        error: error.message || 'Erreur lors de l\'inscription'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

