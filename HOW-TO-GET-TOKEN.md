# 🔑 Comment obtenir votre SUPABASE_ACCESS_TOKEN

## Méthode 1 : Personal Access Token (Recommandé)

### Étapes :

1. **Connectez-vous à Supabase**
   - Allez sur https://app.supabase.com
   - Connectez-vous avec votre compte

2. **Accédez à la page des tokens**
   - Cliquez sur votre **avatar** en haut à droite
   - Sélectionnez **"Account Settings"** ou **"Paramètres du compte"**
   - Dans le menu de gauche, cliquez sur **"Access Tokens"** ou **"Tokens d'accès"**
   
   **OU directement :**
   - Allez sur : https://app.supabase.com/account/tokens

3. **Créez un nouveau token**
   - Cliquez sur **"Generate New Token"** ou **"Générer un nouveau token"**
   - Donnez-lui un nom (ex: "Empire Events Deployment")
   - Cliquez sur **"Generate Token"** ou **"Générer"**

4. **Copiez le token**
   - ⚠️ **IMPORTANT** : Copiez le token immédiatement, vous ne pourrez plus le voir après !
   - Le token commence généralement par `sbp_` suivi d'une longue chaîne de caractères

5. **Ajoutez-le dans votre `.env`**
   ```bash
   echo "SUPABASE_ACCESS_TOKEN=sbp_votre_token_ici" >> .env
   ```
   
   Ou éditez manuellement le fichier `.env` :
   ```env
   SUPABASE_ACCESS_TOKEN=sbp_votre_token_ici
   ```

## Méthode 2 : Via la ligne de commande (Alternative)

Si vous préférez vous connecter interactivement :

```bash
npx supabase login
```

Cela ouvrira votre navigateur pour vous authentifier automatiquement.

## Vérification

Pour vérifier que votre token fonctionne :

```bash
export SUPABASE_ACCESS_TOKEN=votre_token
npx supabase projects list
```

Si ça fonctionne, vous verrez la liste de vos projets Supabase.

## 🔒 Sécurité

- ⚠️ Ne partagez **JAMAIS** votre token d'accès
- ⚠️ Ne commitez **JAMAIS** le fichier `.env` dans Git (il est déjà dans `.gitignore`)
- ⚠️ Si vous pensez que votre token a été compromis, supprimez-le et créez-en un nouveau

## 📝 Liens utiles

- Page des tokens : https://app.supabase.com/account/tokens
- Documentation : https://supabase.com/docs/reference/api/v1-bulk-update-functions

