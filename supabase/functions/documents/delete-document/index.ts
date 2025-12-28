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

    const body = await req.json()

    if (!body.document_id) {
      throw new Error('document_id est requis')
    }

    // Vérifier que le document existe
    const { data: existingDocument } = await supabaseAdmin
      .from('documents')
      .select('event_id, uploaded_by')
      .eq('id', body.document_id)
      .single()

    if (!existingDocument) {
      throw new Error('Document introuvable')
    }

    // Vérifier les permissions
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Profil introuvable')
    }

    // Seul l'uploader ou un admin peut supprimer
    if (existingDocument.uploaded_by !== user.id && profile.role !== 'admin' && profile.role !== 'super_admin') {
      throw new Error('Accès non autorisé à ce document')
    }

    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', body.document_id)

    if (error) {
      throw new Error(`Erreur lors de la suppression du document: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Document supprimé avec succès' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur lors de la suppression du document' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

