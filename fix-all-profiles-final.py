#!/usr/bin/env python3
"""
Script FINAL pour corriger TOUTES les fonctions Edge
- Ajoute supabaseAdmin si nécessaire
- Remplace supabaseClient.from('profiles') par supabaseAdmin.from('profiles')
- Remplace supabaseClient.from('clients') par supabaseAdmin.from('clients')
"""

import re
from pathlib import Path

def fix_file(file_path):
    """Corrige un fichier Edge Function"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # Vérifier si on utilise profiles ou clients
    uses_profiles = re.search(r"\.from\(['\"]profiles['\"]\)", content)
    uses_clients = re.search(r"\.from\(['\"]clients['\"]\)", content)
    
    if not uses_profiles and not uses_clients:
        return False  # Pas besoin de corriger
    
    # 1. Ajouter supabaseAdmin si nécessaire
    if (uses_profiles or uses_clients) and "supabaseAdmin" not in content:
        # Trouver où créer supabaseClient (après sa création)
        # Pattern: const supabaseClient = createClient(...)
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
        # Pattern: supabaseClient.from('profiles') ou supabaseClient.from("profiles")
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
    
    # 4. Corriger les requêtes sur events qui utilisent clients/profiles avec supabaseAdmin
    if "supabaseAdmin" in content and re.search(r"clients.*profiles|profiles.*clients", content):
        # Si on fait un select avec clients ou profiles dans le select, utiliser supabaseAdmin
        content = re.sub(
            r"(let\s+query\s*=\s*)supabaseClient\.from\(['\"]events['\"]\)",
            r"\1supabaseAdmin.from('events')",
            content
        )
        content = re.sub(
            r"(const\s+.*=\s*)supabaseClient\.from\(['\"]events['\"]\)",
            r"\1supabaseAdmin.from('events')",
            content
        )
        if "supabaseAdmin.from('events')" in content:
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

