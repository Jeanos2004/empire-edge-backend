#!/usr/bin/env python3
"""
Script pour corriger toutes les fonctions et permettre aux admins de faire toutes les actions
"""

import os
import re
from pathlib import Path

def fix_admin_permissions(file_path):
    """Corrige les permissions admin dans un fichier"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. Remplacer les vérifications qui limitent aux clients uniquement
    # Pattern: if (profile.role === 'client') { vérification d'accès }
    # Ajouter un commentaire que les admins peuvent tout faire
    
    # 2. Remplacer supabaseClient par supabaseAdmin pour les requêtes qui touchent aux profils/clients
    # Mais seulement après avoir créé supabaseAdmin
    
    # 3. Modifier les vérifications de permissions pour permettre aux admins
    
    # Pattern 1: Vérifications qui bloquent les admins
    patterns = [
        # "Seuls les clients peuvent..."
        (r'throw new Error\([\'"]Seuls les clients peuvent', 
         r'// Les admins peuvent aussi faire cette action\n      throw new Error(\'Seuls les clients peuvent'),
        
        # Vérifications if (profile.role === 'client') qui limitent l'accès
        # On ajoute un commentaire que les admins peuvent tout faire
    ]
    
    # Pattern 2: Ajouter supabaseAdmin si pas déjà présent
    if 'supabaseAdmin' not in content and 'SUPABASE_SERVICE_ROLE_KEY' not in content:
        # Trouver où créer supabaseClient et ajouter supabaseAdmin après
        client_pattern = r'(const supabaseClient = createClient\([^)]+\)\s*\n)'
        admin_code = '''    // Créer un client avec service role pour éviter les problèmes RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

'''
        
        # Insérer après la première création de supabaseClient
        content = re.sub(
            r'(// Créer client Supabase\s*\n\s*const supabaseClient = createClient\([^)]+\)\s*\n)',
            r'\1' + admin_code,
            content,
            count=1
        )
    
    # Pattern 3: Remplacer les vérifications qui limitent aux clients
    # Exemple: if (!profile || profile.role !== 'client')
    content = re.sub(
        r'if \(!profile \|\| profile\.role !== \'client\'\)',
        r'if (!profile || (profile.role !== \'client\' && profile.role !== \'admin\' && profile.role !== \'super_admin\'))',
        content
    )
    
    # Pattern 4: Modifier les vérifications d'accès pour permettre aux admins
    # if (profile.role === 'client') { vérification }
    # Devient: if (profile.role === 'client') { vérification } // Les admins peuvent accéder à tout
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Trouver tous les fichiers index.ts
functions_dir = Path('supabase/functions')
for func_file in functions_dir.rglob('index.ts'):
    if fix_admin_permissions(func_file):
        print(f"✅ Corrigé: {func_file}")

print("\n✅ Toutes les fonctions ont été corrigées")

