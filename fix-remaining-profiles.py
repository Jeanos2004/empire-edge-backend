#!/usr/bin/env python3
"""
Script pour corriger TOUTES les fonctions restantes qui utilisent supabaseClient pour profiles/clients
"""

import re
from pathlib import Path

def fix_file(file_path):
    """Corrige un fichier Edge Function"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # Vérifier si on utilise profiles ou clients avec supabaseClient
    uses_profiles_client = re.search(r"supabaseClient\.from\(['\"]profiles['\"]\)", content)
    uses_clients_client = re.search(r"supabaseClient\.from\(['\"]clients['\"]\)", content)
    
    if not uses_profiles_client and not uses_clients_client:
        return False  # Pas besoin de corriger
    
    # 1. Ajouter supabaseAdmin si nécessaire (après la création de supabaseClient)
    if "supabaseAdmin" not in content:
        # Trouver où créer supabaseClient (après sa création)
        pattern = r'(const supabaseClient = createClient\([^)]+\)\s*\n)'
        replacement = r'''\1
    // Créer un client avec service role pour récupérer le profil (évite les problèmes RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

'''
        new_content = re.sub(pattern, replacement, content, count=1)
        if new_content != content:
            content = new_content
            modified = True
    
    # 2. Remplacer supabaseClient.from('profiles') par supabaseAdmin.from('profiles')
    if "supabaseAdmin" in content:
        content = re.sub(
            r"supabaseClient\.from\(['\"]profiles['\"]\)",
            r"supabaseAdmin.from('profiles')",
            content
        )
        if "supabaseAdmin.from('profiles')" in content:
            modified = True
        
        # 3. Remplacer supabaseClient.from('clients') par supabaseAdmin.from('clients')
        content = re.sub(
            r"supabaseClient\.from\(['\"]clients['\"]\)",
            r"supabaseAdmin.from('clients')",
            content
        )
        if "supabaseAdmin.from('clients')" in content:
            modified = True
    
    if modified and content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Liste des fichiers à corriger
files_to_fix = [
    'supabase/functions/admin/generate-invoice/index.ts',
    'supabase/functions/admin/assign-provider/index.ts',
    'supabase/functions/admin/get-all-events/index.ts',
    'supabase/functions/payments/create-payment-intent/index.ts',
    'supabase/functions/payments/confirm-payment/index.ts',
    'supabase/functions/quotes/send-quote/index.ts',
    'supabase/functions/quotes/create-quote/index.ts',
    'supabase/functions/notifications/create-notification/index.ts',
]

fixed_count = 0
fixed_files = []

for file_path in files_to_fix:
    func_file = Path(file_path)
    if func_file.exists():
        if fix_file(func_file):
            fixed_files.append(str(func_file))
            fixed_count += 1

print(f"\n✅ {fixed_count} fichiers corrigés:")
for f in fixed_files:
    print(f"  - {f}")

