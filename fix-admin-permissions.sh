#!/bin/bash

# Script pour permettre aux admins de faire toutes les actions

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction des permissions admin${NC}\n"

# Fonction pour corriger les vérifications de permissions
fix_permissions() {
    local file=$1
    echo -e "${BLUE}📝 Correction de $file${NC}"
    
    # Remplacer les vérifications qui limitent aux clients uniquement
    # Pattern: if (profile.role === 'client') { ... vérification ... }
    # Devient: if (profile.role === 'client') { ... vérification ... } else if (profile.role === 'admin' || profile.role === 'super_admin') { ... admin peut tout faire ... }
    
    # Pour les fonctions qui vérifient l'accès aux événements/clients
    # On change la logique pour que les admins puissent accéder à tout
    
    # Exemple: events/update-event, events/delete-event, etc.
    # On change: if (profile.role === 'client') { vérifier que c'est son événement }
    # En: if (profile.role === 'client') { vérifier que c'est son événement } 
    #    // Les admins peuvent accéder à tous les événements
    
    echo -e "${YELLOW}⚠️  Correction manuelle requise pour $file${NC}"
}

# Liste des fichiers à corriger
files=(
    "supabase/functions/events/update-event/index.ts"
    "supabase/functions/events/delete-event/index.ts"
    "supabase/functions/events/get-event-details/index.ts"
    "supabase/functions/quotes/accept-quote/index.ts"
    "supabase/functions/quotes/reject-quote/index.ts"
    "supabase/functions/quotes/get-quote/index.ts"
    "supabase/functions/services/add-service-to-event/index.ts"
    "supabase/functions/services/remove-service-from-event/index.ts"
    "supabase/functions/venues/reserve-venue/index.ts"
    "supabase/functions/guests/add-guests/index.ts"
    "supabase/functions/guests/send-invitations/index.ts"
    "supabase/functions/guests/get-guest-list/index.ts"
    "supabase/functions/payments/create-payment-intent/index.ts"
    "supabase/functions/payments/confirm-payment/index.ts"
    "supabase/functions/payments/get-payment-history/index.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        fix_permissions "$file"
    fi
done

echo -e "\n${GREEN}✅ Script terminé${NC}"
echo -e "${YELLOW}⚠️  Les corrections doivent être faites manuellement${NC}"

