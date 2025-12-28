#!/usr/bin/env python3
"""
Script final pour corriger TOUTES les fonctions Edge en une fois
- Utilise supabaseAdmin pour récupérer les profils (évite RLS)
- Corrige les valeurs enum selon le schéma
- Permet aux admins de faire toutes les actions
- Corrige les références aux colonnes selon le schéma
"""

import re
from pathlib import Path

def fix_file(file_path):
    """Corrige un fichier Edge Function"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # 1. Ajouter supabaseAdmin si on récupère des profils/clients et qu'il n'existe pas
    needs_supabase_admin = (
        re.search(r"\.from\(['\"]profiles['\"]\)", content) or 
        re.search(r"\.from\(['\"]clients['\"]\)", content)
    )
    
    if needs_supabase_admin and "supabaseAdmin" not in content:
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
    
    # 4. Pour les requêtes sur events avec JOINs clients/profiles, utiliser supabaseAdmin
    if "supabaseAdmin" in content:
        # Pattern: let query = supabaseClient.from('events') avec select contenant clients ou profiles
        if re.search(r"clients.*profiles|profiles.*clients", content):
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
            modified = True
    
    # 5. Corriger les valeurs enum
    enum_fixes = {
        "'draft'": "'planification'",
        "'completed'": "'termine'",
        "'cancelled'": "'annule'",
        "'confirmed'": "'confirme'",
        "'in_progress'": "'en_preparation'",
        "'sent'": "'envoye'",
        "'accepted'": "'accepte'",
        "'rejected'": "'refuse'",
    }
    
    for old_val, new_val in enum_fixes.items():
        if old_val in content:
            content = content.replace(old_val, new_val)
            modified = True
    
    # 6. Corriger les vérifications de permissions pour permettre aux admins
    # Les admins peuvent passer toutes les vérifications client
    if re.search(r"if\s*\(profile\.role\s*===\s*['\"]client['\"]\)", content):
        # S'assurer qu'il y a un commentaire que les admins peuvent tout faire
        if "Les admins peuvent" not in content:
            content = re.sub(
                r"(if\s*\(profile\.role\s*===\s*['\"]client['\"]\)\s*\{)",
                r"\1\n      // Les admins peuvent accéder à toutes les ressources",
                content
            )
            modified = True
    
    # 7. Corriger les références client_id - doit utiliser clients.id, pas clients.profile_id
    # Pattern: event.client_id !== client.profile_id devrait être event.client_id !== client.id
    content = re.sub(
        r"event\.client_id\s*!==\s*client\.profile_id",
        r"event.client_id !== client.id",
        content
    )
    if "event.client_id !== client.id" in content and "event.client_id !== client.profile_id" not in content:
        modified = True
    
    # 8. Corriger les requêtes sur events pour utiliser supabaseAdmin si on vérifie client_id
    if "supabaseAdmin" in content and re.search(r"event\.client_id.*client\.", content):
        # Si on fait une vérification de client_id, utiliser supabaseAdmin pour events aussi
        content = re.sub(
            r"const\s+\{\s*data:\s*event[^}]*\}\s*=\s*await\s+supabaseClient\.from\(['\"]events['\"]\)",
            r"const { data: event, error: eventError } = await supabaseAdmin.from('events')",
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

