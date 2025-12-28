#!/usr/bin/env python3
"""
Script pour corriger toutes les références incorrectes à client.profile_id
- event.client_id référence clients.id, pas clients.profile_id
- Quand on filtre par client_id, on doit utiliser client.id
"""

import re
from pathlib import Path

def fix_file(file_path):
    """Corrige un fichier Edge Function"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    modified = False
    
    # 1. Corriger .select('profile_id') en .select('id, profile_id') pour clients
    # Car on a besoin de client.id pour comparer avec event.client_id
    content = re.sub(
        r"\.select\(['\"]profile_id['\"]\)",
        r".select('id, profile_id')",
        content
    )
    if ".select('id, profile_id')" in content:
        modified = True
    
    # 2. Corriger event.client_id !== client.profile_id en event.client_id !== client.id
    content = re.sub(
        r"event\.client_id\s*!==\s*client\.profile_id",
        r"event.client_id !== client.id",
        content
    )
    if "event.client_id !== client.id" in content:
        modified = True
    
    # 3. Corriger .eq('client_id', client.profile_id) en .eq('client_id', client.id)
    content = re.sub(
        r"\.eq\(['\"]client_id['\"],\s*client\.profile_id\)",
        r".eq('client_id', client.id)",
        content
    )
    if ".eq('client_id', client.id)" in content:
        modified = True
    
    # 4. Corriger .eq('client_id', client.profile_id) dans les requêtes events
    content = re.sub(
        r"\.eq\(['\"]client_id['\"],\s*client\.profile_id\)",
        r".eq('client_id', client.id)",
        content
    )
    if ".eq('client_id', client.id)" in content:
        modified = True
    
    # 5. Corriger les requêtes qui utilisent client.profile_id pour filtrer events
    # Pattern: .eq('client_id', client.profile_id) devrait être .eq('client_id', client.id)
    content = re.sub(
        r"query\s*=\s*query\.eq\(['\"]client_id['\"],\s*client\.profile_id\)",
        r"query = query.eq('client_id', client.id)",
        content
    )
    if "query = query.eq('client_id', client.id)" in content:
        modified = True
    
    # 6. Corriger les requêtes dans les tableaux d'événements
    # Pattern: .eq('client_id', client.profile_id) dans les requêtes events
    content = re.sub(
        r"\.eq\(['\"]client_id['\"],\s*client\.profile_id\)",
        r".eq('client_id', client.id)",
        content
    )
    if ".eq('client_id', client.id)" in content:
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

