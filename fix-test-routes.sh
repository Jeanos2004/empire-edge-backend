#!/bin/bash

# Script pour corriger toutes les routes dans les fichiers test.http

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction des routes dans les fichiers test.http${NC}\n"

# Fonction pour convertir auth/register en auth-register
convert_route() {
    local path=$1
    echo "$path" | tr '/' '-'
}

# Trouver tous les fichiers test.http
find supabase/functions -name "test.http" | while read test_file; do
    # Extraire le chemin de la fonction (ex: auth/register)
    func_path=$(echo "$test_file" | sed 's|supabase/functions/||' | sed 's|/test.http||')
    
    # Convertir en nom de route (ex: auth-register)
    route_name=$(convert_route "$func_path")
    
    echo -e "${BLUE}📝 Correction de $test_file${NC}"
    echo -e "   Route: /$route_name"
    
    # Remplacer toutes les occurrences de l'ancienne route par la nouvelle
    # Chercher les patterns comme /auth/register, /events/create-event, etc.
    old_route="/$func_path"
    new_route="/$route_name"
    
    # Remplacer dans le fichier
    sed -i "s|$old_route|$new_route|g" "$test_file"
    
    # Aussi remplacer les variantes possibles
    old_route2="{{baseUrl}}/$func_path"
    new_route2="{{baseUrl}}/$route_name"
    sed -i "s|$old_route2|$new_route2|g" "$test_file"
    
    # Remplacer les patterns avec functions/v1/
    old_route3="/functions/v1/$func_path"
    new_route3="/functions/v1/$route_name"
    sed -i "s|$old_route3|$new_route3|g" "$test_file"
done

echo -e "\n${GREEN}✅ Tous les fichiers test.http ont été corrigés${NC}"

