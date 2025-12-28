import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const testimonialId = url.searchParams.get('testimonial_id')

    if (!testimonialId) {
      throw new Error('testimonial_id est requis')
    }

    // Récupérer le témoignage
    const { data: testimonial, error: testimonialError } = await supabaseAdmin
      .from('testimonials')
      .select(`
        *,
        clients(id, profiles(id, first_name, last_name, avatar_url)),
        events(id, title, event_type)
      `)
      .eq('id', testimonialId)
      .single()

    if (testimonialError || !testimonial) {
      throw new Error(`Témoignage introuvable: ${testimonialError?.message || 'Témoignage non trouvé'}`)
    }

    // Si le témoignage n'est pas approuvé, vérifier que l'utilisateur est admin
    if (!testimonial.is_approved) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
            throw new Error('Témoignage non approuvé - Accès réservé aux administrateurs')
          }
        } else {
          throw new Error('Témoignage non approuvé - Accès réservé aux administrateurs')
        }
      } else {
        throw new Error('Témoignage non approuvé - Accès réservé aux administrateurs')
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: testimonial }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la récupération du témoignage' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

