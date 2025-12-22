# 🔐 Connexion à Supabase

## Option 1 : Via le terminal (recommandé)

Ouvrez un terminal dans votre éditeur et exécutez :

```bash
npx supabase login
```

Cela ouvrira votre navigateur pour vous authentifier.

## Option 2 : Via un Access Token

1. Allez sur https://app.supabase.com/account/tokens
2. Créez un nouveau token (ou utilisez un existant)
3. Ajoutez-le dans votre fichier `.env` :

```env
SUPABASE_ACCESS_TOKEN=votre_token_ici
```

## Option 3 : Déployer directement avec un token

Si vous avez déjà un token, vous pouvez l'utiliser directement :

```bash
export SUPABASE_ACCESS_TOKEN=votre_token
npx supabase functions deploy auth/register --project-ref qjfygjtondljywhbqbfj
```

## Après la connexion

Une fois connecté, vous pouvez déployer avec :

```bash
./deploy-with-npx.sh
```

