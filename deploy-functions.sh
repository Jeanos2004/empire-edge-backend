#!/bin/bash

# Script de déploiement des Edge Functions Supabase
# Usage: ./deploy-functions.sh [function_name]

set -e

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Déploiement des Edge Functions Supabase${NC}\n"

# Vérifier si npx est disponible (Supabase CLI via npx)
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx n'est pas disponible. Installez Node.js${NC}"
    exit 1
fi

# Tester si Supabase CLI fonctionne via npx
if ! npx supabase --version > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Supabase CLI sera téléchargé via npx au premier déploiement${NC}"
fi

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    echo "Créez un fichier .env avec vos clés Supabase (voir .env.example)"
    exit 1
fi

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

# Vérifier les variables requises
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Variables SUPABASE_URL et SUPABASE_ANON_KEY requises dans .env${NC}"
    exit 1
fi

# Fonction pour convertir auth/register en auth-register
convert_function_name() {
    local func_name=$1
    echo "$func_name" | tr '/' '-'
}

# Fonction pour déployer une fonction spécifique
deploy_function() {
    local func_name=$1
    local func_path="supabase/functions/$func_name"
    
    if [ ! -d "$func_path" ]; then
        echo -e "${RED}❌ Fonction $func_name non trouvée dans $func_path${NC}"
        return 1
    fi
    
    # Convertir le nom pour Supabase (auth/register -> auth-register)
    local supabase_func_name=$(convert_function_name "$func_name")
    
    echo -e "${BLUE}📦 Déploiement de $func_name (nom Supabase: $supabase_func_name)...${NC}"
    
    # Se déplacer dans le dossier supabase/functions et déployer avec le chemin relatif
    cd supabase/functions
    npx supabase functions deploy "$supabase_func_name" --project-ref qjfygjtondljywhbqbfj --no-verify-jwt
    local deploy_status=$?
    cd ../..
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $func_name déployée avec succès${NC}\n"
    else
        echo -e "${RED}❌ Erreur lors du déploiement de $func_name${NC}\n"
        return 1
    fi
}

# Si un nom de fonction est fourni, déployer uniquement celle-ci
if [ ! -z "$1" ]; then
    deploy_function "$1"
    exit $?
fi

# Sinon, déployer toutes les fonctions
echo -e "${BLUE}📋 Liste des fonctions à déployer:${NC}\n"

# Liste de toutes les fonctions
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

# Déployer chaque fonction
success_count=0
fail_count=0

for func in "${functions[@]}"; do
    if deploy_function "$func"; then
        ((success_count++))
    else
        ((fail_count++))
    fi
done

# Résumé
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Succès: $success_count${NC}"
if [ $fail_count -gt 0 ]; then
    echo -e "${RED}❌ Échecs: $fail_count${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les fonctions ont été déployées avec succès!${NC}"
    exit 0
else
    exit 1
fi

