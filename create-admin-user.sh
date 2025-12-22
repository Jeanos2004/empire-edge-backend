#!/bin/bash

# Script pour créer un utilisateur admin dans Supabase

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

# Demander les informations
read -p "Email de l'admin: " ADMIN_EMAIL
read -p "Mot de passe (min 6 caractères): " ADMIN_PASSWORD
read -p "Prénom: " FIRST_NAME
read -p "Nom: " LAST_NAME
read -p "Téléphone: " PHONE

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$FIRST_NAME" ] || [ -z "$LAST_NAME" ]; then
    echo -e "${RED}❌ Tous les champs sont requis${NC}"
    exit 1
fi

if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}❌ Le mot de passe doit contenir au moins 6 caractères${NC}"
    exit 1
fi

echo -e "\n${BLUE}📦 Création de l'utilisateur...${NC}"

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
    PROFILE_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "{
        \"id\": \"$USER_ID\",
        \"role\": \"admin\",
        \"first_name\": \"$FIRST_NAME\",
        \"last_name\": \"$LAST_NAME\",
        \"phone\": \"$PHONE\"
      }")
    
    if echo "$PROFILE_RESPONSE" | grep -q '"id"'; then
        echo -e "${GREEN}✅ Profil admin créé avec succès${NC}\n"
        echo -e "${BLUE}📋 Informations de connexion:${NC}"
        echo -e "   Email: ${GREEN}$ADMIN_EMAIL${NC}"
        echo -e "   Mot de passe: ${YELLOW}******${NC}"
        echo -e "   Rôle: ${GREEN}admin${NC}\n"
        echo -e "${BLUE}🔑 Pour obtenir un token JWT, utilisez la fonction auth/login${NC}"
    else
        echo -e "${YELLOW}⚠️  Utilisateur créé mais erreur lors de la création du profil${NC}"
        echo -e "${BLUE}Créez manuellement le profil avec role='admin'${NC}"
    fi
else
    echo -e "${RED}❌ Erreur lors de la création de l'utilisateur${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

