# 📋 Guide des Données de Test

Ce guide explique comment créer des données de test complètes pour l'application Empire Events en suivant le flux logique.

## 📁 Fichiers Disponibles

1. **`test-data-complete.http`** - Fichier HTTP avec toutes les requêtes dans l'ordre logique
2. **`sql-test-data.sql`** - Script SQL pour créer les données de base (venues, services, providers)

## 🚀 Étapes pour Créer les Données de Test

### Étape 1: Préparer l'Environnement

1. **Obtenir les tokens d'authentification** :
   - Connectez-vous en tant qu'admin via `auth-login`
   - Connectez-vous en tant que client via `auth-login`
   - Copiez les tokens dans les variables du fichier `test-data-complete.http`

### Étape 2: Exécuter le Script SQL

1. Allez sur le **SQL Editor** de Supabase : https://app.supabase.com/project/qjfygjtondljywhbqbfj/sql/new
2. Copiez le contenu de `sql-test-data.sql`
3. Exécutez le script pour créer :
   - 6 lieux (venues)
   - 14 services
   - 12 providers
   - Disponibilités de lieux
   - Articles de blog (optionnel)
   - Témoignages (optionnel)

### Étape 3: Créer les Clients

Utilisez le fichier `test-data-complete.http` et exécutez les requêtes dans l'ordre :

1. **Créer 3 clients** via `auth-register`
2. **Se connecter** pour obtenir les tokens de chaque client
3. **Copier les tokens** dans les variables `@client1Token`, `@client2Token`, `@client3Token`

### Étape 4: Créer les Événements

1. Créez 4 événements différents (mariage, séminaire, anniversaire, conférence)
2. **Notez les IDs** des événements créés (EVENT_1_ID, EVENT_2_ID, etc.)
3. Remplacez les placeholders dans les requêtes suivantes

### Étape 5: Réserver des Lieux

1. Récupérez les IDs des venues depuis la base de données
2. Réservez des lieux pour les événements créés
3. Remplacez `VENUE_1_ID`, `VENUE_2_ID` par les vrais IDs

### Étape 6: Ajouter des Services

1. Récupérez les IDs des services depuis la base de données
2. Récupérez les IDs des providers depuis la base de données
3. Ajoutez des services aux événements
4. Remplacez `SERVICE_1_ID`, `PROVIDER_1_ID` par les vrais IDs

### Étape 7: Créer des Devis

1. Créez des devis pour les événements
2. **Notez les IDs** des devis créés (QUOTE_1_ID, QUOTE_2_ID)
3. Envoyez les devis aux clients
4. Les clients peuvent accepter ou rejeter les devis

### Étape 8: Gérer les Invités

1. Ajoutez des invités aux événements
2. Envoyez les invitations
3. Les invités peuvent répondre via RSVP

### Étape 9: Gérer les Paiements

1. Créez des intentions de paiement
2. Confirmez les paiements avec des preuves

### Étape 10: Communication

1. Envoyez des messages entre clients et admin
2. Créez des notifications

## 📊 Flux Logique Complet

```
1. Créer Clients (register)
   ↓
2. Se Connecter (login) → Obtenir Tokens
   ↓
3. Créer Événements (create-event)
   ↓
4. Réserver Lieux (reserve-venue)
   ↓
5. Ajouter Services (add-service-to-event)
   ↓
6. Créer Devis (create-quote)
   ↓
7. Envoyer Devis (send-quote)
   ↓
8. Accepter/Rejeter Devis (accept-quote / reject-quote)
   ↓
9. Ajouter Invités (add-guests)
   ↓
10. Envoyer Invitations (send-invitations)
   ↓
11. RSVP Invités (rsvp)
   ↓
12. Créer Paiements (create-payment-intent)
   ↓
13. Confirmer Paiements (confirm-payment)
   ↓
14. Messages & Notifications
```

## 🔍 Récupérer les IDs

### Via les Réponses des Requêtes

Chaque requête POST retourne un objet avec les données créées. Exemple :

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Mariage de Jean et Sophie",
    ...
  }
}
```

Copiez l'`id` et remplacez les placeholders dans les requêtes suivantes.

### Via les Requêtes GET

Utilisez les requêtes GET pour récupérer les listes :
- `GET /events-get-events` - Liste des événements
- `GET /services-get-services` - Liste des services
- `GET /venues-get-venues` - Liste des lieux

## ⚠️ Notes Importantes

1. **Remplacez tous les placeholders** :
   - `EVENT_1_ID`, `EVENT_2_ID`, etc.
   - `CLIENT_1_ID`, `CLIENT_2_ID`, etc.
   - `VENUE_1_ID`, `SERVICE_1_ID`, `PROVIDER_1_ID`, etc.
   - `QUOTE_1_ID`, `PAYMENT_INTENT_1_ID`, etc.

2. **Les tokens expirent** : Si un token expire, reconnectez-vous et mettez à jour les variables.

3. **Ordre important** : Suivez l'ordre des requêtes car certaines dépendent des précédentes.

4. **SQL d'abord** : Exécutez le script SQL avant de commencer les requêtes HTTP.

## 🧪 Tester les Données

Une fois toutes les données créées, vous pouvez :

1. **Voir le dashboard admin** : `GET /admin-dashboard-stats`
2. **Voir tous les événements** : `GET /admin-get-all-events`
3. **Voir les détails d'un événement** : `GET /events-get-event-details?event_id=...`
4. **Voir l'historique des paiements** : `GET /payments-get-payment-history?event_id=...`

## 📝 Exemple d'Utilisation

```http
### 1. Créer un client
POST {{baseUrl}}/auth-register
Content-Type: application/json
{
  "email": "jean.dupont@example.com",
  "password": "password123",
  ...
}

### 2. Se connecter (copier le token de la réponse)
POST {{baseUrl}}/auth-login
Content-Type: application/json
{
  "email": "jean.dupont@example.com",
  "password": "password123"
}

### 3. Mettre à jour la variable
@client1Token = eyJhbGciOiJIUzI1NiIs...

### 4. Créer un événement
POST {{baseUrl}}/events-create-event
Authorization: Bearer {{client1Token}}
{
  ...
}

### 5. Noter l'ID de l'événement et l'utiliser dans les requêtes suivantes
```

## 🎯 Données Créées

Avec ces scripts, vous créerez :

- ✅ **3 clients** avec profils complets
- ✅ **4 événements** de types différents
- ✅ **6 lieux** (venues) avec disponibilités
- ✅ **14 services** variés
- ✅ **12 providers** pour les services
- ✅ **Plusieurs devis** avec items
- ✅ **Invités** avec invitations
- ✅ **Paiements** avec confirmations
- ✅ **Messages** entre clients et admin
- ✅ **Notifications** système

Bon test ! 🚀

