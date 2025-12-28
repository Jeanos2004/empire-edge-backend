#!/bin/bash

# Script pour corriger toutes les fonctions qui récupèrent des profils avec RLS

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction des fonctions avec problèmes RLS sur profiles${NC}\n"

# Liste des fonctions à corriger
functions=(
    "events/get-events"
    "events/get-event-details"
    "events/update-event"
    "events/delete-event"
    "quotes/get-quote"
    "quotes/accept-quote"
    "quotes/reject-quote"
    "services/add-service-to-event"
    "services/remove-service-from-event"
    "venues/reserve-venue"
    "guests/add-guests"
    "guests/send-invitations"
    "guests/get-guest-list"
    "payments/create-payment-intent"
    "payments/confirm-payment"
    "payments/get-payment-history"
    "messages/send-message"
    "messages/get-messages"
    "notifications/create-notification"
    "notifications/mark-notification-read"
    "admin/dashboard-stats"
    "admin/get-all-events"
    "admin/assign-provider"
    "admin/generate-invoice"
    "auth/update-profile"
)

for func in "${functions[@]}"; do
    func_file="supabase/functions/$func/index.ts"
    if [ -f "$func_file" ]; then
        echo -e "${BLUE}📝 Correction de $func${NC}"
        
        # Remplacer la récupération du profil avec service role
        # Pattern 1: supabaseClient.from('profiles')
        sed -i "s/const { data: profile } = await supabaseClient\.from('profiles')/\/\/ Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)\n    const supabaseAdmin = createClient(\n      Deno.env.get('SUPABASE_URL') ?? '',\n      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''\n    )\n\n    const { data: profile } = await supabaseAdmin.from('profiles')/g" "$func_file"
        
        # Pattern 2: supabaseClient.from(\"profiles\")
        sed -i 's/const { data: profile } = await supabaseClient\.from("profiles")/\/\/ Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)\n    const supabaseAdmin = createClient(\n      Deno.env.get("SUPABASE_URL") ?? "",\n      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""\n    )\n\n    const { data: profile } = await supabaseAdmin.from("profiles")/g' "$func_file"
    fi
done

echo -e "\n${GREEN}✅ Corrections appliquées${NC}"
echo -e "${BLUE}⚠️  Vérifiez manuellement les fichiers modifiés${NC}"
echo -e "${BLUE}📦 Redéployez avec: ./deploy-functions-fixed.sh${NC}"

