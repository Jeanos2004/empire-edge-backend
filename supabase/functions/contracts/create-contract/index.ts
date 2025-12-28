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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Non authentifié')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      throw new Error('Accès réservé aux administrateurs')
    }

    const body = await req.json()

    if (!body.quote_id || !body.content) {
      throw new Error('quote_id et content sont requis')
    }

    // Vérifier que le devis existe
    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id')
      .eq('id', body.quote_id)
      .single()

    if (!quote) {
      throw new Error('Devis introuvable')
    }

    // Générer un numéro de contrat unique
    const year = new Date().getFullYear()
    const { data: lastContract } = await supabaseAdmin
      .from('contracts')
      .select('contract_number')
      .like('contract_number', `CTR-${year}%`)
      .order('contract_number', { ascending: false })
      .limit(1)
      .single()

    let contractNumber = `CTR-${year}0001`
    if (lastContract?.contract_number) {
      const lastNum = parseInt(lastContract.contract_number.slice(-4))
      contractNumber = `CTR-${year}${String(lastNum + 1).padStart(4, '0')}`
    }

    const { data: contract, error } = await supabaseAdmin
      .from('contracts')
      .insert({
        quote_id: body.quote_id,
        contract_number: contractNumber,
        content: body.content,
        signed_at: body.signed_at || null,
        signature_client: body.signature_client || null,
        signature_empire: body.signature_empire || null,
        pdf_url: body.pdf_url || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la création du contrat: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: contract }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création du contrat' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

