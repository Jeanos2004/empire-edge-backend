# 🚀 Guide de Déploiement des Edge Functions

## 📋 Prérequis

1. **Supabase CLI** installé globalement
2. **Clés d'API** de votre projet Supabase

## 🔧 Configuration

### 1. Créer le fichier `.env`

Créez un fichier `.env` à la racine du projet avec le contenu suivant:

```bash
# Variables Supabase
SUPABASE_URL=https://qjfygjtondljywhbqbfj.supabase.co
SUPABASE_ANON_KEY=votre_anon_key_ici
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
```

**Où trouver ces clés:**
- Allez sur https://app.supabase.com/project/qjfygjtondljywhbqbfj/settings/api
- Copiez `anon` `public` key → `SUPABASE_ANON_KEY`
- Copiez `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Installer Supabase CLI

```bash
npm install -g supabase
```

### 3. Se connecter à Supabase

```bash
supabase login
```

Cela ouvrira votre navigateur pour vous authentifier.

## 🚀 Déploiement

### Déployer toutes les fonctions

```bash
./deploy-functions.sh
```

ou

```bash
npm run deploy
```

### Déployer une fonction spécifique

```bash
./deploy-functions.sh auth/register
```

ou

```bash
supabase functions deploy auth/register --project-ref qjfygjtondljywhbqbfj
```

## 📝 Liste des fonctions

- `auth/register`
- `auth/login`
- `auth/update-profile`
- `events/create-event`
- `events/get-events`
- `events/get-event-details`
- `events/update-event`
- `events/delete-event`
- `quotes/create-quote`
- `quotes/get-quote`
- `quotes/send-quote`
- `quotes/accept-quote`
- `quotes/reject-quote`
- `services/get-services`
- `services/add-service-to-event`
- `services/remove-service-from-event`
- `venues/get-venues`
- `venues/check-availability`
- `venues/reserve-venue`
- `guests/add-guests`
- `guests/send-invitations`
- `guests/rsvp`
- `guests/get-guest-list`
- `payments/create-payment-intent`
- `payments/confirm-payment`
- `payments/get-payment-history`
- `messages/send-message`
- `messages/get-messages`
- `messages/mark-as-read`
- `notifications/create-notification`
- `notifications/mark-notification-read`
- `admin/dashboard-stats`
- `admin/get-all-events`
- `admin/assign-provider`
- `admin/generate-invoice`
- `public/get-blog-posts`
- `public/get-testimonials`
- `public/submit-contact-form`

## 🔍 Vérification

Après le déploiement, vérifiez vos fonctions sur:
https://app.supabase.com/project/qjfygjtondljywhbqbfj/functions

## ⚠️ Notes importantes

- Le fichier `.env` est dans `.gitignore` pour ne pas être commité
- Utilisez `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur (jamais côté client)
- Les fonctions utilisent automatiquement les variables d'environnement de Supabase

