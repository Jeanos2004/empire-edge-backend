# 🚀 Déploiement des Edge Functions - Guide Rapide

## ⚡ Démarrage Rapide

### 1. Configuration initiale (une seule fois)

```bash
./setup.sh
```

Ce script va:
- ✅ Vérifier Node.js
- ✅ Installer Supabase CLI
- ✅ Créer le fichier `.env`
- ✅ Vous connecter à Supabase

### 2. Remplir vos clés Supabase

Éditez le fichier `.env` et remplacez les valeurs:

```bash
nano .env
# ou
code .env
```

Récupérez vos clés depuis: https://app.supabase.com/project/qjfygjtondljywhbqbfj/settings/api

```env
SUPABASE_URL=https://qjfygjtondljywhbqbfj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Votre clé anon
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Votre clé service_role
```

### 3. Déployer toutes les fonctions

**Option A - Script Bash:**
```bash
./deploy-functions.sh
```

**Option B - Script Python:**
```bash
python3 deploy-functions.py
```

**Option C - Une fonction spécifique:**
```bash
./deploy-functions.sh auth/register
# ou
python3 deploy-functions.py auth/register
```

**Option D - Directement avec Supabase CLI:**
```bash
supabase functions deploy auth/register --project-ref qjfygjtondljywhbqbfj
```

## 📋 Liste complète des 38 fonctions

### Auth (3)
- `auth/register`
- `auth/login`
- `auth/update-profile`

### Events (5)
- `events/create-event`
- `events/get-events`
- `events/get-event-details`
- `events/update-event`
- `events/delete-event`

### Quotes (5)
- `quotes/create-quote`
- `quotes/get-quote`
- `quotes/send-quote`
- `quotes/accept-quote`
- `quotes/reject-quote`

### Services (3)
- `services/get-services`
- `services/add-service-to-event`
- `services/remove-service-from-event`

### Venues (3)
- `venues/get-venues`
- `venues/check-availability`
- `venues/reserve-venue`

### Guests (4)
- `guests/add-guests`
- `guests/send-invitations`
- `guests/rsvp`
- `guests/get-guest-list`

### Payments (3)
- `payments/create-payment-intent`
- `payments/confirm-payment`
- `payments/get-payment-history`

### Messages (3)
- `messages/send-message`
- `messages/get-messages`
- `messages/mark-as-read`

### Notifications (2)
- `notifications/create-notification`
- `notifications/mark-notification-read`

### Admin (4)
- `admin/dashboard-stats`
- `admin/get-all-events`
- `admin/assign-provider`
- `admin/generate-invoice`

### Public (3)
- `public/get-blog-posts`
- `public/get-testimonials`
- `public/submit-contact-form`

## 🔍 Vérification

Après le déploiement, vérifiez vos fonctions sur:
https://app.supabase.com/project/qjfygjtondljywhbqbfj/functions

## 🆘 Dépannage

### Erreur: "Supabase CLI not found"
```bash
npm install -g supabase
```

### Erreur: "Not logged in"
```bash
supabase login
```

### Erreur: "Project not found"
Vérifiez que votre `project-ref` est correct: `qjfygjtondljywhbqbfj`

### Erreur: "Invalid API key"
Vérifiez vos clés dans `.env` depuis le dashboard Supabase

## 📝 Notes

- Le fichier `.env` est dans `.gitignore` (ne sera pas commité)
- Les fonctions utilisent automatiquement les variables d'environnement de Supabase
- Vous pouvez déployer une fonction à la fois pour tester

