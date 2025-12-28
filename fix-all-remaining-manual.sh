#!/bin/bash

# Script pour corriger manuellement toutes les fonctions restantes

FUNCTIONS=(
  "admin/assign-provider"
  "admin/get-all-events"
  "quotes/send-quote"
  "payments/confirm-payment"
)

for func in "${FUNCTIONS[@]}"; do
  file="supabase/functions/$func/index.ts"
  if [ -f "$file" ]; then
    echo "Correction de $file..."
    # Ajouter supabaseAdmin après supabaseClient si nécessaire
    if grep -q "supabaseClient\.from.*profiles\|supabaseClient\.from.*clients" "$file" && ! grep -q "supabaseAdmin" "$file"; then
      # Trouver la ligne après la création de supabaseClient
      sed -i '/const supabaseClient = createClient(/,/)/ {
        a\
\
    // Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)\
    const supabaseAdmin = createClient(\
      Deno.env.get('\''SUPABASE_URL'\'') ?? '\'''\'',\
      Deno.env.get('\''SUPABASE_SERVICE_ROLE_KEY'\'') ?? '\'''\''\
    )
      }' "$file"
    fi
    # Remplacer supabaseClient.from('profiles') par supabaseAdmin.from('profiles')
    sed -i "s/supabaseClient\.from\(['\"]profiles['\"]\)/supabaseAdmin.from('profiles')/g" "$file"
    sed -i "s/supabaseClient\.from\(['\"]clients['\"]\)/supabaseAdmin.from('clients')/g" "$file"
    echo "✅ $file corrigé"
  fi
done

