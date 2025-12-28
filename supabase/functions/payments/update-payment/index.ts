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

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    const body = await req.json()

    if (!body.payment_id) {
      throw new Error('payment_id est requis')
    }

    // Vérifier que le paiement existe
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('event_id')
      .eq('id', body.payment_id)
      .single()

    if (!existingPayment) {
      throw new Error('Paiement introuvable')
    }

    // Vérifier les permissions
    if (profile.role === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!client) {
        throw new Error('Client introuvable')
      }

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('client_id')
        .eq('id', existingPayment.event_id)
        .single()

      if (!event || event.client_id !== client.id) {
        throw new Error('Accès non autorisé à ce paiement')
      }
    }

    const updates: any = {}
    if (body.amount !== undefined) updates.amount = body.amount
    if (body.payment_type !== undefined) {
      const validPaymentTypes = ['acompte', 'echeance', 'solde', 'remboursement']
      if (!validPaymentTypes.includes(body.payment_type)) {
        throw new Error(`payment_type invalide. Valeurs acceptées: ${validPaymentTypes.join(', ')}`)
      }
      updates.payment_type = body.payment_type
    }
    if (body.status !== undefined) {
      const validStatuses = ['en_attente', 'acompte_recu', 'partiellement_paye', 'paye', 'rembourse', 'annule']
      if (!validStatuses.includes(body.status)) {
        throw new Error(`status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`)
      }
      updates.status = body.status
    }
    if (body.due_date !== undefined) updates.due_date = body.due_date
    if (body.paid_at !== undefined) updates.paid_at = body.paid_at
    if (body.payment_method !== undefined) updates.payment_method = body.payment_method
    if (body.transaction_id !== undefined) updates.transaction_id = body.transaction_id
    if (body.receipt_url !== undefined) updates.receipt_url = body.receipt_url
    if (body.notes !== undefined) updates.notes = body.notes

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .update(updates)
      .eq('id', body.payment_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur lors de la mise à jour du paiement: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: payment, message: 'Paiement mis à jour avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la mise à jour du paiement' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

