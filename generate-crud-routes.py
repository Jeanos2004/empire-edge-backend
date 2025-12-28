#!/usr/bin/env python3
"""
Script pour générer toutes les routes CRUD manquantes
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
FUNCTIONS_DIR = BASE_DIR / "supabase" / "functions"

# Template pour une fonction CRUD
CRUD_TEMPLATE = """import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

{body_code}

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: {status} }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || '{error_message}' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
"""

# Routes CRUD à créer
ROUTES_TO_CREATE = [
    # Venues
    ("venues/create-venue", "POST", "venues", "create", "Créer un lieu"),
    ("venues/get-venue", "GET", "venues", "get", "Récupérer un lieu"),
    ("venues/update-venue", "POST", "venues", "update", "Mettre à jour un lieu"),
    ("venues/delete-venue", "DELETE", "venues", "delete", "Supprimer un lieu"),
    
    # Services
    ("services/create-service", "POST", "services", "create", "Créer un service"),
    ("services/get-service", "GET", "services", "get", "Récupérer un service"),
    ("services/update-service", "POST", "services", "update", "Mettre à jour un service"),
    ("services/delete-service", "DELETE", "services", "delete", "Supprimer un service"),
    
    # Guests
    ("guests/get-guest", "GET", "guests", "get", "Récupérer un invité"),
    ("guests/update-guest", "POST", "guests", "update", "Mettre à jour un invité"),
    ("guests/delete-guest", "DELETE", "guests", "delete", "Supprimer un invité"),
    
    # Payments
    ("payments/get-payment", "GET", "payments", "get", "Récupérer un paiement"),
    ("payments/update-payment", "POST", "payments", "update", "Mettre à jour un paiement"),
    ("payments/delete-payment", "DELETE", "payments", "delete", "Supprimer un paiement"),
    
    # Messages
    ("messages/get-message", "GET", "messages", "get", "Récupérer un message"),
    ("messages/update-message", "POST", "messages", "update", "Mettre à jour un message"),
    ("messages/delete-message", "DELETE", "messages", "delete", "Supprimer un message"),
    
    # Notifications
    ("notifications/get-notifications", "GET", "notifications", "list", "Récupérer les notifications"),
    ("notifications/get-notification", "GET", "notifications", "get", "Récupérer une notification"),
    ("notifications/update-notification", "POST", "notifications", "update", "Mettre à jour une notification"),
    ("notifications/delete-notification", "DELETE", "notifications", "delete", "Supprimer une notification"),
    
    # Contracts
    ("contracts/create-contract", "POST", "contracts", "create", "Créer un contrat"),
    ("contracts/get-contracts", "GET", "contracts", "list", "Récupérer les contrats"),
    ("contracts/get-contract", "GET", "contracts", "get", "Récupérer un contrat"),
    ("contracts/update-contract", "POST", "contracts", "update", "Mettre à jour un contrat"),
    ("contracts/delete-contract", "DELETE", "contracts", "delete", "Supprimer un contrat"),
    
    # Documents
    ("documents/create-document", "POST", "documents", "create", "Créer un document"),
    ("documents/get-documents", "GET", "documents", "list", "Récupérer les documents"),
    ("documents/get-document", "GET", "documents", "get", "Récupérer un document"),
    ("documents/update-document", "POST", "documents", "update", "Mettre à jour un document"),
    ("documents/delete-document", "DELETE", "documents", "delete", "Supprimer un document"),
    
    # Blog Posts (admin)
    ("blog/create-post", "POST", "blog_posts", "create", "Créer un article de blog"),
    ("blog/get-post", "GET", "blog_posts", "get", "Récupérer un article de blog"),
    ("blog/update-post", "POST", "blog_posts", "update", "Mettre à jour un article de blog"),
    ("blog/delete-post", "DELETE", "blog_posts", "delete", "Supprimer un article de blog"),
    
    # Testimonials (admin)
    ("testimonials/create-testimonial", "POST", "testimonials", "create", "Créer un témoignage"),
    ("testimonials/get-testimonial", "GET", "testimonials", "get", "Récupérer un témoignage"),
    ("testimonials/update-testimonial", "POST", "testimonials", "update", "Mettre à jour un témoignage"),
    ("testimonials/delete-testimonial", "DELETE", "testimonials", "delete", "Supprimer un témoignage"),
]

print(f"📋 {len(ROUTES_TO_CREATE)} routes CRUD à créer")
print("\nRoutes à créer:")
for route, method, table, action, desc in ROUTES_TO_CREATE:
    print(f"  - {route} ({method}) - {desc}")

print("\n⚠️  Note: Ce script liste les routes à créer. Le code complet sera généré manuellement pour chaque route.")

