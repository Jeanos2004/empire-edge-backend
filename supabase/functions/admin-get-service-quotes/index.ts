// @ts-nocheck
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

    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      throw new Error('Accès réservé aux administrateurs')
    }

    // GET: return all service requests
    if (req.method === 'GET') {
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'service_requests')
        .single()

      return new Response(
        JSON.stringify({ success: true, data: settings?.value || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // POST: update a request status
    if (req.method === 'POST') {
      const body = await req.json()
      const { request_id, status } = body

      const { data: existing } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'service_requests')
        .single()

      const requests = (existing?.value || []).map((r: any) =>
        r.id === request_id ? { ...r, status, updated_at: new Date().toISOString() } : r
      )

      await supabaseAdmin
        .from('settings')
        .update({ value: requests, updated_at: new Date().toISOString() })
        .eq('key', 'service_requests')

      return new Response(
        JSON.stringify({ success: true, message: 'Statut mis à jour' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    throw new Error('Méthode non supportée')
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
