#!/bin/bash

# Script de déploiement avec conversion automatique de la structure

# Ne pas arrêter sur erreur pour continuer avec les autres fonctions
set +e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Déploiement des Edge Functions Supabase${NC}\n"

# Vérifier npx
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx n'est pas disponible${NC}"
    exit 1
fi

# Vérifier .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    exit 1
fi

# Charger les variables
export $(cat .env | grep -v '^#' | xargs)

PROJECT_REF="qjfygjtondljywhbqbfj"
TEMP_DIR=".supabase-deploy-temp"

# Nettoyer le dossier temporaire
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Créer la structure temporaire (Supabase CLI attend supabase/functions/)
mkdir -p "$TEMP_DIR/supabase/functions"

# Fonction pour convertir le nom
convert_name() {
    echo "$1" | tr '/' '-'
}

# Fonction pour déployer
deploy_function() {
    local func_name=$1
    local func_path="supabase/functions/$func_name"
    local supabase_name=$(convert_name "$func_name")
    
    if [ ! -d "$func_path" ]; then
        echo -e "${RED}❌ $func_name non trouvé${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📦 $func_name -> $supabase_name${NC}"
    
    # Copier vers la structure temporaire (Supabase CLI attend supabase/functions/)
    cp -r "$func_path" "$TEMP_DIR/supabase/functions/$supabase_name"
    
    # Déployer depuis le dossier temporaire
    cd "$TEMP_DIR"
    npx supabase functions deploy "$supabase_name" --project-ref "$PROJECT_REF" > /tmp/deploy_output.log 2>&1
    local deploy_status=$?
    cd ..
    rm -rf "$TEMP_DIR/supabase/functions/$supabase_name"
    
    if [ $deploy_status -eq 0 ]; then
        echo -e "${GREEN}✅ $func_name déployée${NC}\n"
        return 0
    else
        echo -e "${RED}❌ Erreur pour $func_name${NC}"
        tail -3 /tmp/deploy_output.log 2>/dev/null || echo "Vérifiez les logs"
        echo ""
        return 1
    fi
}

# Liste des fonctions
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

# Si une fonction spécifique est fournie
if [ ! -z "$1" ]; then
    deploy_function "$1"
    exit $?
fi

# Déployer toutes
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
[ $failed -gt 0 ] && echo -e "${RED}❌ Échecs: $failed${NC}"
echo -e "${BLUE}════════════════════════════════${NC}"

