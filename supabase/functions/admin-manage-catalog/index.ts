// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Format par défaut du catalogue
const DEFAULT_CATALOG = {
  eventTypes: [
    { id: "mariage_moderne", label: "Mariage Moderne" },
    { id: "anniversaire_adulte", label: "Anniversaire Adulte" },
    { id: "baby_shower", label: "Baby Shower / Baptême" },
    { id: "seminaire", label: "Séminaire d'entreprise" },
    { id: "reception_privee", label: "Réception Privée" }
  ],
  services: [
    { id: "hall", name: "Location de salle", eventTypes: ["mariage_moderne", "anniversaire_adulte", "reception_privee"] },
    { id: "catering", name: "Traiteur", eventTypes: ["mariage_moderne", "anniversaire_adulte", "baby_shower", "seminaire", "reception_privee"] },
    { id: "decor", name: "Décoration événementielle", eventTypes: ["mariage_moderne", "reception_privee"] },
    { id: "photo", name: "Photographie", eventTypes: ["mariage_moderne", "anniversaire_adulte", "baby_shower", "reception_privee"] },
    { id: "dj", name: "Animation / DJ", eventTypes: ["mariage_moderne", "reception_privee", "anniversaire_adulte"] }
  ],
  preferences: {
    "catering": {
      label: "Type de repas souhaité",
      options: ["Cuisine Africaine", "Cuisine Européenne", "Mixte", "Buffet", "Autre"],
      allowOther: true
    },
    "decor": {
      label: "Style de décoration",
      options: ["Classique / Épuré", "Traditionnel", "Moderne / Glamour", "Autre"],
      allowOther: true
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'GET') {
      // Fetch catalog
      const { data, error } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'quote_form_catalog')
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is not found
        throw error;
      }

      const catalog = data?.value || DEFAULT_CATALOG;

      return new Response(JSON.stringify({ success: true, data: catalog }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (req.method === 'POST') {
      // Authenticate user for write operations
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Non authentifié : en-tête Authorization manquant')
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      )

      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        throw new Error('Non authentifié')
      }

      // Check role
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        throw new Error('Accès réservé aux administrateurs')
      }

      const body = await req.json()
      const { catalog } = body

      if (!catalog) throw new Error('Catalogue requis');

      // Upsert setting
      const { data, error } = await supabaseAdmin
        .from('settings')
        .upsert(
          { key: 'quote_form_catalog', value: catalog, description: 'Configuration dynamique du formulaire de devis' },
          { onConflict: 'key' }
        )

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: 'Catalogue mis à jour' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
