#!/bin/bash

# Déploiement rapide avec vérification du token

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_REF="qjfygjtondljywhbqbfj"

# Charger .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo -e "${BLUE}🚀 Déploiement rapide${NC}\n"

# Vérifier le token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_ACCESS_TOKEN non trouvé dans .env${NC}"
    echo -e "${BLUE}Pour obtenir un token:${NC}"
    echo "1. Allez sur https://app.supabase.com/account/tokens"
    echo "2. Créez un token"
    echo "3. Ajoutez dans .env: SUPABASE_ACCESS_TOKEN=votre_token"
    echo ""
    echo -e "${YELLOW}Ou connectez-vous manuellement:${NC}"
    echo "npx supabase login"
    exit 1
fi

# Tester la connexion
echo -e "${BLUE}🔍 Test de connexion...${NC}"
if npx supabase projects list > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connecté à Supabase${NC}\n"
else
    echo -e "${RED}❌ Erreur de connexion${NC}"
    echo "Vérifiez votre SUPABASE_ACCESS_TOKEN"
    exit 1
fi

# Fonction pour déployer
deploy_func() {
    local func=$1
    echo -n "📦 $func... "
    if npx supabase functions deploy "$func" --project-ref "$PROJECT_REF" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        return 0
    else
        echo -e "${RED}❌${NC}"
        return 1
    fi
}

# Déployer toutes les fonctions
functions=(
    "auth/register" "auth/login" "auth/update-profile"
    "events/create-event" "events/get-events" "events/get-event-details" "events/update-event" "events/delete-event"
    "quotes/create-quote" "quotes/get-quote" "quotes/send-quote" "quotes/accept-quote" "quotes/reject-quote"
    "services/get-services" "services/add-service-to-event" "services/remove-service-from-event"
    "venues/get-venues" "venues/check-availability" "venues/reserve-venue"
    "guests/add-guests" "guests/send-invitations" "guests/rsvp" "guests/get-guest-list"
    "payments/create-payment-intent" "payments/confirm-payment" "payments/get-payment-history"
    "messages/send-message" "messages/get-messages" "messages/mark-as-read"
    "notifications/create-notification" "notifications/mark-notification-read"
    "admin/dashboard-stats" "admin/get-all-events" "admin/assign-provider" "admin/generate-invoice"
    "public/get-blog-posts" "public/get-testimonials" "public/submit-contact-form"
)

success=0
failed=0

for func in "${functions[@]}"; do
    if deploy_func "$func"; then
        ((success++))
    else
        ((failed++))
    fi
done

echo ""
echo -e "${BLUE}════════════════════════════════${NC}"
echo -e "${GREEN}✅ Succès: $success${NC}"
[ $failed -gt 0 ] && echo -e "${RED}❌ Échecs: $failed${NC}"
echo -e "${BLUE}════════════════════════════════${NC}"

