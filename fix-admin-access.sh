#!/bin/bash

# Script pour permettre aux admins d'accéder à toutes les ressources

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction des permissions admin${NC}\n"

# Fonction pour ajouter un commentaire après les vérifications client
add_admin_comment() {
    local file=$1
    # Ajouter un commentaire après chaque "if (profile.role === 'client')" pour indiquer que les admins peuvent tout faire
    sed -i 's/if (profile\.role === '\''client'\'') {/if (profile.role === '\''client'\'') {\n      \/\/ Les admins peuvent accéder à tout/g' "$file"
    sed -i 's/} else if (profile\.role === '\''client'\'') {/} else if (profile.role === '\''client'\'') {\n      \/\/ Les admins peuvent accéder à tout/g' "$file"
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
        echo -e "${BLUE}📝 Traitement de $file${NC}"
        # Remplacer les vérifications qui bloquent les admins
        # Les admins peuvent faire toutes les actions, donc on ne vérifie que pour les clients
        sed -i 's/if (!client || existingEvent\.client_id !== client\.profile_id) {/if (!client || existingEvent.client_id !== client.profile_id) {\n        \/\/ Les admins peuvent modifier tous les événements/g' "$file"
        sed -i 's/if (!client || event\.client_id !== client\.profile_id) {/if (!client || event.client_id !== client.profile_id) {\n        \/\/ Les admins peuvent accéder à tous les événements/g' "$file"
    fi
done

echo -e "\n${GREEN}✅ Corrections appliquées${NC}"

