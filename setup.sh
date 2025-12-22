#!/bin/bash

# Script de configuration initiale

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔧 Configuration du projet Empire Events${NC}\n"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js n'est pas installé${NC}"
    echo "Installez Node.js depuis https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js trouvé: $(node --version)${NC}"

# Installer Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${BLUE}📦 Installation de Supabase CLI...${NC}"
    npm install -g supabase
    echo -e "${GREEN}✅ Supabase CLI installé${NC}"
else
    echo -e "${GREEN}✅ Supabase CLI déjà installé: $(supabase --version)${NC}"
fi

# Créer .env si n'existe pas
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Création du fichier .env...${NC}"
    cat > .env << EOF
# Variables Supabase
# Récupérez ces valeurs depuis: https://app.supabase.com/project/qjfygjtondljywhbqbfj/settings/api

SUPABASE_URL=https://qjfygjtondljywhbqbfj.supabase.co
SUPABASE_ANON_KEY=votre_anon_key_ici
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
EOF
    echo -e "${GREEN}✅ Fichier .env créé${NC}"
    echo -e "${YELLOW}⚠️  N'oubliez pas de remplir vos clés dans .env${NC}"
else
    echo -e "${GREEN}✅ Fichier .env existe déjà${NC}"
fi

# Se connecter à Supabase
echo -e "\n${BLUE}🔐 Connexion à Supabase...${NC}"
echo "Ouvrez votre navigateur pour vous authentifier"
supabase login

echo -e "\n${GREEN}✅ Configuration terminée!${NC}"
echo -e "\n${BLUE}Prochaines étapes:${NC}"
echo "1. Remplissez vos clés dans le fichier .env"
echo "2. Déployez les fonctions avec: ./deploy-functions.sh"
echo "   ou: python3 deploy-functions.py"

