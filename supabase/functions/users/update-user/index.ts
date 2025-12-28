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

    // Parser le body
    const body = await req.json()

    if (!body.user_id) {
      throw new Error('user_id est requis')
    }

    // Les admins peuvent modifier tous les utilisateurs, les clients peuvent modifier uniquement leur propre profil
    if (profile.role !== 'admin' && profile.role !== 'super_admin' && body.user_id !== user.id) {
      throw new Error('Accès non autorisé')
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

    // Préparer les données de mise à jour du profil
    const profileUpdates: any = {}
    if (body.first_name !== undefined) profileUpdates.first_name = body.first_name
    if (body.last_name !== undefined) profileUpdates.last_name = body.last_name
    if (body.phone !== undefined) profileUpdates.phone = body.phone
    if (body.company_name !== undefined) profileUpdates.company_name = body.company_name
    if (body.avatar_url !== undefined) profileUpdates.avatar_url = body.avatar_url

    // Seuls les admins peuvent changer le rôle
    if (body.role !== undefined) {
      if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        throw new Error('Seuls les administrateurs peuvent modifier le rôle')
      }
      const validRoles = ['client', 'admin', 'super_admin', 'prestataire']
      if (!validRoles.includes(body.role)) {
        throw new Error(`Rôle invalide. Valeurs acceptées: ${validRoles.join(', ')}`)
      }
      profileUpdates.role = body.role
    }

    // Mettre à jour le profil (utiliser supabaseAdmin)
    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', body.user_id)

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du profil: ${updateError.message}`)
      }
    }

    // Préparer les données de mise à jour du client
    const clientUpdates: any = {}
    if (body.address !== undefined) clientUpdates.address = body.address
    if (body.city !== undefined) clientUpdates.city = body.city
    if (body.preferences !== undefined) clientUpdates.preferences = body.preferences
    if (body.notes !== undefined) clientUpdates.notes = body.notes

    // Mettre à jour les infos client si des données sont fournies
    if (Object.keys(clientUpdates).length > 0) {
      const { error: clientError } = await supabaseAdmin
        .from('clients')
        .update(clientUpdates)
        .eq('profile_id', body.user_id)

      if (clientError) {
        throw new Error(`Erreur lors de la mise à jour du client: ${clientError.message}`)
      }
    }

    // Mettre à jour l'email dans Auth si fourni (admin uniquement)
    if (body.email && (profile.role === 'admin' || profile.role === 'super_admin')) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(body.user_id, {
        email: body.email
      })

      if (emailError) {
        throw new Error(`Erreur lors de la mise à jour de l'email: ${emailError.message}`)
      }
    }

    // Récupérer le profil mis à jour
    const { data: updatedProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        clients(*)
      `)
      .eq('id', body.user_id)
      .single()

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération du profil: ${fetchError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedProfile,
        message: 'Utilisateur mis à jour avec succès'
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
        error: error.message || 'Erreur lors de la mise à jour de l\'utilisateur'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

