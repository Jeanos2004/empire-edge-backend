#!/bin/bash

# Script de déploiement utilisant npx (pas besoin d'installer Supabase CLI globalement)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Déploiement des Edge Functions avec npx${NC}\n"

# Charger les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

PROJECT_REF="qjfygjtondljywhbqbfj"

# Fonction pour déployer une fonction
deploy_function() {
    local func_name=$1
    echo -e "${BLUE}📦 Déploiement de $func_name...${NC}"
    
    npx supabase functions deploy "$func_name" --project-ref "$PROJECT_REF" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $func_name déployée${NC}\n"
        return 0
    else
        echo -e "${RED}❌ Erreur pour $func_name${NC}\n"
        return 1
    fi
}

# Liste des fonctions
functions=(
    "auth/register"
    "auth/login"
    "auth/update-profile"
    "events/create-event"
    "events/get-events"
    "events/get-event-details"
    "events/update-event"
    "events/delete-event"
    "quotes/create-quote"
    "quotes/get-quote"
    "quotes/send-quote"
    "quotes/accept-quote"
    "quotes/reject-quote"
    "services/get-services"
    "services/add-service-to-event"
    "services/remove-service-from-event"
    "venues/get-venues"
    "venues/check-availability"
    "venues/reserve-venue"
    "guests/add-guests"
    "guests/send-invitations"
    "guests/rsvp"
    "guests/get-guest-list"
    "payments/create-payment-intent"
    "payments/confirm-payment"
    "payments/get-payment-history"
    "messages/send-message"
    "messages/get-messages"
    "messages/mark-as-read"
    "notifications/create-notification"
    "notifications/mark-notification-read"
    "admin/dashboard-stats"
    "admin/get-all-events"
    "admin/assign-provider"
    "admin/generate-invoice"
    "public/get-blog-posts"
    "public/get-testimonials"
    "public/submit-contact-form"
)

# Si une fonction spécifique est fournie
if [ ! -z "$1" ]; then
    deploy_function "$1"
    exit $?
fi

# Déployer toutes les fonctions
success=0
failed=0

for func in "${functions[@]}"; do
    if deploy_function "$func"; then
        ((success++))
    else
        ((failed++))
    fi
done

echo -e "${BLUE}════════════════════════════════${NC}"
echo -e "${GREEN}✅ Succès: $success${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}❌ Échecs: $failed${NC}"
fi
echo -e "${BLUE}════════════════════════════════${NC}\n"

