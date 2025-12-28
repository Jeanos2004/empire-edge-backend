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

    // Seuls les admins peuvent changer les rôles
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès réservé aux administrateurs')
    }

    // Parser le body
    const body = await req.json()

    if (!body.user_id) {
      throw new Error('user_id est requis')
    }

    if (!body.role) {
      throw new Error('role est requis')
    }

    // Valider le rôle
    const validRoles = ['client', 'admin', 'super_admin', 'prestataire']
    if (!validRoles.includes(body.role)) {
      throw new Error(`Rôle invalide. Valeurs acceptées: ${validRoles.join(', ')}`)
    }

    // Ne pas permettre de changer son propre rôle
    if (body.user_id === user.id) {
      throw new Error('Vous ne pouvez pas changer votre propre rôle')
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

    // Ne pas permettre à un admin de promouvoir quelqu'un en super_admin (seuls les super_admin peuvent)
    if (body.role === 'super_admin' && profile.role !== 'super_admin') {
      throw new Error('Seuls les super administrateurs peuvent promouvoir un utilisateur en super administrateur')
    }

    // Ne pas permettre de rétrograder un super_admin (seuls les super_admin peuvent)
    if (existingProfile.role === 'super_admin' && profile.role !== 'super_admin') {
      throw new Error('Seuls les super administrateurs peuvent modifier le rôle d\'un super administrateur')
    }

    // Mettre à jour le rôle (utiliser supabaseAdmin)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: body.role })
      .eq('id', body.user_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour du rôle: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedProfile,
        message: `Rôle de l'utilisateur changé en ${body.role} avec succès`
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
        error: error.message || 'Erreur lors du changement de rôle'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

