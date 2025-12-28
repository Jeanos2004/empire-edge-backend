#!/bin/bash

# Script pour corriger toutes les fonctions pour utiliser supabaseAdmin pour les profils
# et corriger les valeurs enum selon le schéma

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction de toutes les fonctions Edge${NC}\n"

# Liste de tous les fichiers index.ts
find supabase/functions -name "index.ts" | while read file; do
    echo -e "${BLUE}📝 Traitement de $file${NC}"
    
    # 1. Ajouter supabaseAdmin si on récupère des profils et qu'il n'existe pas
    if grep -q "from(['\"]profiles['\"])" "$file" && ! grep -q "supabaseAdmin" "$file"; then
        # Trouver où créer supabaseClient et ajouter supabaseAdmin après
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
    
    # 2. Remplacer supabaseClient.from('profiles') par supabaseAdmin.from('profiles')
    sed -i "s/supabaseClient\.from(['\"]profiles['\"])/supabaseAdmin.from('profiles')/g" "$file"
    
    # 3. Remplacer supabaseClient.from('clients') par supabaseAdmin.from('clients') si supabaseAdmin existe
    if grep -q "supabaseAdmin" "$file"; then
        sed -i "s/supabaseClient\.from(['\"]clients['\"])/supabaseAdmin.from('clients')/g" "$file"
    fi
    
    # 4. Corriger les valeurs enum incorrectes
    sed -i "s/'draft'/'planification'/g" "$file"
    sed -i "s/'completed'/'termine'/g" "$file"
    sed -i "s/'cancelled'/'annule'/g" "$file"
    sed -i "s/'confirmed'/'confirme'/g" "$file"
    sed -i "s/'in_progress'/'en_preparation'/g" "$file"
    sed -i "s/'sent'/'envoye'/g" "$file"
    sed -i "s/'accepted'/'accepte'/g" "$file"
    sed -i "s/'rejected'/'refuse'/g" "$file"
    
    echo -e "${GREEN}✅ $file corrigé${NC}"
done

echo -e "\n${GREEN}✅ Toutes les fonctions ont été corrigées${NC}"

