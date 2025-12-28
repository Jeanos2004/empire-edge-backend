#!/bin/bash

# Script pour créer un utilisateur admin avec des valeurs par défaut

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}👤 Création d'un utilisateur admin${NC}\n"

# Charger les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans .env${NC}"
    exit 1
fi

# Valeurs par défaut (peuvent être surchargées par des variables d'environnement)
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@empire-events.com"}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-"Admin123456"}
FIRST_NAME=${ADMIN_FIRST_NAME:-"Admin"}
LAST_NAME=${ADMIN_LAST_NAME:-"Empire"}
PHONE=${ADMIN_PHONE:-"+224612345678"}

echo -e "${BLUE}📋 Informations de l'admin:${NC}"
echo -e "   Email: ${GREEN}$ADMIN_EMAIL${NC}"
echo -e "   Mot de passe: ${YELLOW}$ADMIN_PASSWORD${NC}"
echo -e "   Nom: ${GREEN}$FIRST_NAME $LAST_NAME${NC}"
echo -e "   Téléphone: ${GREEN}$PHONE${NC}\n"

echo -e "${BLUE}📦 Création de l'utilisateur...${NC}"

# Créer l'utilisateur via l'API Supabase
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"first_name\": \"$FIRST_NAME\",
      \"last_name\": \"$LAST_NAME\",
      \"phone\": \"$PHONE\"
    }
  }")

# Vérifier si la création a réussi
if echo "$RESPONSE" | grep -q '"id"'; then
    USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Utilisateur créé avec l'ID: $USER_ID${NC}"
    
    # Créer le profil avec le rôle admin
    PROFILE_JSON=$(cat <<EOF
{
  "id": "$USER_ID",
  "role": "admin",
  "first_name": "$FIRST_NAME",
  "last_name": "$LAST_NAME",
  "phone": "$PHONE"
}
EOF
)
    
    PROFILE_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "$PROFILE_JSON")
    
    if echo "$PROFILE_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅ Profil admin créé avec succès${NC}\n"
        echo -e "${BLUE}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}🎉 Admin créé avec succès!${NC}\n"
        echo -e "${BLUE}📋 Informations de connexion:${NC}"
        echo -e "   Email: ${GREEN}$ADMIN_EMAIL${NC}"
        echo -e "   Mot de passe: ${YELLOW}$ADMIN_PASSWORD${NC}"
        echo -e "   Rôle: ${GREEN}admin${NC}\n"
        echo -e "${BLUE}🔑 Pour obtenir un token JWT:${NC}"
        echo -e "   POST ${GREEN}$SUPABASE_URL/functions/v1/auth-login${NC}"
        echo -e "   {"
        echo -e "     \"email\": \"$ADMIN_EMAIL\","
        echo -e "     \"password\": \"$ADMIN_PASSWORD\""
        echo -e "   }"
        echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Utilisateur créé mais erreur lors de la création du profil${NC}"
        echo -e "${BLUE}Créez manuellement le profil avec role='admin' pour l'ID: $USER_ID${NC}"
        echo "$PROFILE_RESPONSE"
    fi
else
    echo -e "${RED}❌ Erreur lors de la création de l'utilisateur${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

