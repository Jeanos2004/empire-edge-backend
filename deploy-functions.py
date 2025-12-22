#!/usr/bin/env python3
"""
Script de déploiement des Edge Functions Supabase
Utilise l'API Supabase Management pour déployer les fonctions
"""

import os
import sys
import json
import subprocess
import zipfile
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional

# Couleurs pour les messages
class Colors:
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    RED = '\033[0;31m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.NC}")

def print_info(msg: str):
    print(f"{Colors.BLUE}📦 {msg}{Colors.NC}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")

def check_supabase_cli() -> bool:
    """Vérifie si Supabase CLI est installé"""
    try:
        result = subprocess.run(['supabase', '--version'], 
                              capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False

def install_supabase_cli():
    """Installe Supabase CLI via npm"""
    print_info("Installation de Supabase CLI...")
    try:
        subprocess.run(['npm', 'install', '-g', 'supabase'], check=True)
        print_success("Supabase CLI installé avec succès")
        return True
    except subprocess.CalledProcessError:
        print_error("Erreur lors de l'installation de Supabase CLI")
        return False
    except FileNotFoundError:
        print_error("npm n'est pas installé. Installez Node.js d'abord.")
        return False

def load_env():
    """Charge les variables d'environnement depuis .env"""
    env_file = Path('.env')
    if not env_file.exists():
        print_error("Fichier .env non trouvé")
        print_info("Créez un fichier .env avec:")
        print("  SUPABASE_URL=https://qjfygjtondljywhbqbfj.supabase.co")
        print("  SUPABASE_ANON_KEY=votre_anon_key")
        print("  SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key")
        sys.exit(1)
    
    env_vars = {}
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
                os.environ[key.strip()] = value.strip()
    
    required_vars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
    missing = [var for var in required_vars if var not in env_vars]
    if missing:
        print_error(f"Variables manquantes dans .env: {', '.join(missing)}")
        sys.exit(1)
    
    return env_vars

def get_all_functions() -> List[str]:
    """Récupère la liste de toutes les fonctions"""
    functions_dir = Path('supabase/functions')
    if not functions_dir.exists():
        print_error("Dossier supabase/functions non trouvé")
        sys.exit(1)
    
    functions = []
    for func_dir in functions_dir.rglob('index.ts'):
        func_path = func_dir.parent.relative_to(functions_dir)
        functions.append(str(func_path))
    
    return sorted(functions)

def deploy_function(func_name: str, project_ref: str = "qjfygjtondljywhbqbfj") -> bool:
    """Déploie une fonction spécifique"""
    func_path = Path(f'supabase/functions/{func_name}')
    
    if not func_path.exists():
        print_error(f"Fonction {func_name} non trouvée dans {func_path}")
        return False
    
    print_info(f"Déploiement de {func_name}...")
    
    try:
        # Utiliser Supabase CLI pour déployer
        cmd = [
            'supabase', 'functions', 'deploy', func_name,
            '--project-ref', project_ref
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success(f"{func_name} déployée avec succès")
            return True
        else:
            print_error(f"Erreur lors du déploiement de {func_name}")
            if result.stderr:
                print(result.stderr)
            return False
    except Exception as e:
        print_error(f"Exception lors du déploiement: {str(e)}")
        return False

def main():
    """Fonction principale"""
    print(f"{Colors.BLUE}🚀 Déploiement des Edge Functions Supabase{Colors.NC}\n")
    
    # Vérifier Supabase CLI
    if not check_supabase_cli():
        print_warning("Supabase CLI n'est pas installé")
        response = input("Voulez-vous l'installer maintenant? (o/n): ")
        if response.lower() in ['o', 'oui', 'y', 'yes']:
            if not install_supabase_cli():
                sys.exit(1)
        else:
            print_error("Supabase CLI est requis pour le déploiement")
            sys.exit(1)
    
    # Charger les variables d'environnement
    load_env()
    
    # Vérifier la connexion
    print_info("Vérification de la connexion à Supabase...")
    try:
        result = subprocess.run(['supabase', 'projects', 'list'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print_warning("Vous n'êtes peut-être pas connecté. Exécutez: supabase login")
    except:
        pass
    
    # Récupérer la fonction à déployer (si fournie en argument)
    if len(sys.argv) > 1:
        func_name = sys.argv[1]
        success = deploy_function(func_name)
        sys.exit(0 if success else 1)
    
    # Déployer toutes les fonctions
    functions = get_all_functions()
    print_info(f"Trouvé {len(functions)} fonctions à déployer\n")
    
    success_count = 0
    fail_count = 0
    
    for func in functions:
        if deploy_function(func):
            success_count += 1
        else:
            fail_count += 1
        print()  # Ligne vide
    
    # Résumé
    print(f"{Colors.BLUE}{'='*40}{Colors.NC}")
    print_success(f"Succès: {success_count}")
    if fail_count > 0:
        print_error(f"Échecs: {fail_count}")
    print(f"{Colors.BLUE}{'='*40}{Colors.NC}\n")
    
    if fail_count == 0:
        print_success("🎉 Toutes les fonctions ont été déployées avec succès!")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()

