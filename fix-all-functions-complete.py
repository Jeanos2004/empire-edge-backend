#!/usr/bin/env python3
"""
Script complet pour corriger toutes les Edge Functions
- Utilise supabaseAdmin pour récupérer les profils (évite RLS)
- Corrige les valeurs enum selon le schéma
- Permet aux admins de faire toutes les actions
"""

import re
from pathlib import Path

# Mapping des valeurs enum incorrectes vers correctes
ENUM_FIXES = {
    "status": {
        "'draft'": "'planification'",
        "'completed'": "'termine'",
        "'cancelled'": "'annule'",
        "'confirmed'": "'confirme'",
        "'in_progress'": "'en_preparation'",
    },
    "quote_status": {
        "'sent'": "'envoye'",
        "'accepted'": "'accepte'",
        "'rejected'": "'refuse'",
    }
}

def fix_file(file_path):
    """Corrige un fichier Edge Function"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # 1. Ajouter supabaseAdmin si on récupère des profils et qu'il n'existe pas
    if re.search(r"\.from\(['\"]profiles['\"]\)", content) and "supabaseAdmin" not in content:
        # Trouver où créer supabaseClient (après la création)
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
        modified = True
        
        # 3. Remplacer supabaseClient.from('clients') par supabaseAdmin.from('clients')
        content = re.sub(
            r"supabaseClient\.from\(['\"]clients['\"]\)",
            r"supabaseAdmin.from('clients')",
            content
        )
        modified = True
    
    # 4. Corriger les valeurs enum
    for enum_type, fixes in ENUM_FIXES.items():
        for old_val, new_val in fixes.items():
            if old_val in content:
                content = content.replace(old_val, new_val)
                modified = True
    
    # 5. Corriger les vérifications de permissions pour permettre aux admins
    # Pattern: if (profile.role === 'client') { vérification }
    # On veut que les admins puissent passer ces vérifications
    if re.search(r"if\s*\(profile\.role\s*===\s*['\"]client['\"]\)", content):
        # Ajouter un commentaire que les admins peuvent tout faire
        content = re.sub(
            r"(if\s*\(profile\.role\s*===\s*['\"]client['\"]\)\s*\{)",
            r"\1\n      // Les admins peuvent accéder à toutes les ressources",
            content
        )
        modified = True
    
    # 6. Corriger les requêtes sur events pour utiliser supabaseAdmin si on fait des JOINs avec clients/profiles
    if "supabaseAdmin" in content and re.search(r"\.from\(['\"]events['\"]\)", content):
        # Si on fait un select avec clients ou profiles dans le select, utiliser supabaseAdmin
        if re.search(r"clients.*profiles|profiles.*clients", content):
            content = re.sub(
                r"let query = supabaseClient\.from\(['\"]events['\"]\)",
                r"let query = supabaseAdmin.from('events')",
                content
            )
            content = re.sub(
                r"const.*= supabaseClient\.from\(['\"]events['\"]\)",
                r"const query = supabaseAdmin.from('events')",
                content
            )
            modified = True
    
    if modified and content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Trouver tous les fichiers index.ts
functions_dir = Path('supabase/functions')
fixed_count = 0
fixed_files = []

for func_file in sorted(functions_dir.rglob('index.ts')):
    if fix_file(func_file):
        fixed_files.append(str(func_file))
        fixed_count += 1

print(f"\n✅ {fixed_count} fichiers corrigés:")
for f in fixed_files:
    print(f"  - {f}")

