# Guide de Déploiement des Edge Functions (Empire Events)

Ce document explique comment les fonctions ont été déployées pour résoudre les erreurs 404 et assurer la compatibilité avec le frontend.

## 1. Convention de Nommage (Slugs)
Le frontend (Empire_Events) s'attend à des endpoints au format avec tirets (ex: `/quotes-submit-request`). 
Pour cette raison, les fonctions sont déployées avec des slugs **sans slashes** :

- `supabase/functions/quotes-submit-request` -> URL: `/quotes-submit-request`
- `supabase/functions/admin-get-all-quotes` -> URL: `/admin-get-all-quotes`
- `supabase/functions/quotes-accept-quote` -> URL: `/quotes-accept-quote`
- `supabase/functions/quotes-reject-quote` -> URL: `/quotes-reject-quote`

## 2. Méthode de Déploiement (Windows)
Sur Windows, la méthode la plus fiable sans installer la CLI globalement est d'utiliser **Git Bash** pour exécuter les commandes `npx`.

### Commande type :
```bash
export SUPABASE_ACCESS_TOKEN=votre_token
npx supabase functions deploy nom-de-la-fonction --project-ref qjfygjtondljywhbqbfj --no-verify-jwt
```

## 3. Pourquoi les anciens dossiers (ex: `quotes/submit-request`) ne marchaient pas ?
Supabase CLI interprète les slashes dans les chemins de dossiers. Si vous déployez `quotes/submit-request`, l'URL générée contient souvent des problèmes de routage ou ne correspond pas exactement à ce que le frontend attend (`/quotes-submit-request`).

En créant un dossier plat `quotes-submit-request`, on garantit que l'URL finale est exactement celle voulue.

## 4. Token d'Accès
Le token utilisé est stocké dans votre fichier `.env.local` sous la variable `SUPABASE_ACCESS_TOKEN`. Ne le partagez pas publiquement.

---
**Note :** Pour tester localement, vous pouvez continuer à utiliser les dossiers organisés, mais pour le **déploiement en production**, utilisez toujours les dossiers au format "slug" (tirets).
