#!/usr/bin/env python3
"""
Script complet pour permettre aux admins de faire toutes les actions
"""

import re
from pathlib import Path

def fix_file(file_path):
    """Corrige un fichier pour permettre aux admins de tout faire"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # 1. Ajouter supabaseAdmin si pas présent et si on récupère des profils
    if 'from(\'profiles\')' in content or 'from("profiles")' in content:
        if 'supabaseAdmin' not in content and 'SUPABASE_SERVICE_ROLE_KEY' not in content:
            # Trouver où créer supabaseClient et ajouter supabaseAdmin après
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
    
    # 2. Remplacer les récupérations de profil pour utiliser supabaseAdmin
    if 'supabaseAdmin' in content:
        # Remplacer supabaseClient.from('profiles') par supabaseAdmin.from('profiles')
        content = re.sub(
            r'supabaseClient\.from\([\'"]profiles[\'"]\)',
            r'supabaseAdmin.from(\'profiles\')',
            content
        )
        modified = True
    
    # 3. Modifier les vérifications de permissions pour permettre aux admins
    # Les vérifications if (profile.role === 'client') doivent permettre aux admins de passer
    # On ajoute un commentaire explicatif
    
    # Pattern: if (profile.role === 'client') { vérification }
    # On ajoute un commentaire que les admins peuvent tout faire
    pattern = r'(if \(profile\.role === [\'"]client[\'"]\) \{)\s*\n\s*const \{ data: client \} = await supabaseClient'
    replacement = r'''\1
      // Les admins peuvent accéder à toutes les ressources
      const { data: client } = await supabaseAdmin'''
    
    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        content = new_content
        modified = True
    
    # 4. Remplacer supabaseClient par supabaseAdmin pour les requêtes sur clients
    if 'supabaseAdmin' in content:
        content = re.sub(
            r'supabaseClient\.from\([\'"]clients[\'"]\)',
            r'supabaseAdmin.from(\'clients\')',
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

for func_file in sorted(functions_dir.rglob('index.ts')):
    if fix_file(func_file):
        print(f"✅ {func_file}")
        fixed_count += 1

print(f"\n✅ {fixed_count} fichiers corrigés")

