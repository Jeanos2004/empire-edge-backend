# 📋 FLUX D'APPLICATION EMPIRE EVENTS - GUIDE COMPLET

## 🎯 Vue d'ensemble

Empire Events est une plateforme de gestion d'événements en Guinée qui permet aux clients de créer, gérer et suivre leurs événements, et aux administrateurs de gérer les devis, les services et les prestataires.

---

## 🔐 1. AUTHENTIFICATION ET INSCRIPTION

### 1.1 Inscription d'un nouveau client

**Route :** `POST /auth-register`

**Flux :**
1. L'utilisateur fournit ses informations (email, mot de passe, nom, prénom, téléphone, adresse, etc.)
2. Un compte utilisateur est créé dans `auth.users` (Supabase Auth)
3. Un profil est créé dans la table `profiles` avec le rôle `client`
4. Une entrée client est créée dans la table `clients` liée au profil
5. L'utilisateur reçoit un token JWT pour les requêtes suivantes

**Données créées :**
- `auth.users` : Compte d'authentification
- `profiles` : Profil utilisateur avec rôle `client`
- `clients` : Informations client (adresse, ville, préférences)

### 1.2 Connexion

**Route :** `POST /auth-login`

**Flux :**
1. L'utilisateur fournit son email et mot de passe
2. Supabase Auth authentifie l'utilisateur
3. Le profil est récupéré depuis la table `profiles`
4. Un token JWT est retourné avec les informations du profil

**Token JWT :**
- Contient l'ID utilisateur, l'email, le rôle
- Valide pendant 1 heure
- À inclure dans le header `Authorization: Bearer <token>` pour toutes les requêtes authentifiées

### 1.3 Mise à jour du profil

**Route :** `POST /auth-update-profile`

**Flux :**
1. L'utilisateur authentifié met à jour ses informations
2. Le profil dans `profiles` est mis à jour
3. Les informations client dans `clients` sont mises à jour si nécessaire

---

## 📅 2. GESTION DES ÉVÉNEMENTS

### 2.1 Création d'un événement

**Route :** `POST /events-create-event`

**Flux :**
1. **Client** : Crée un événement pour lui-même
   - L'événement est automatiquement associé au client connecté
   - Statut par défaut : `planification`

2. **Admin** : Peut créer un événement pour n'importe quel client
   - Peut spécifier un `client_id` dans le body
   - Si aucun `client_id` n'est fourni, le premier client disponible est utilisé

**Données requises :**
- `event_type` : Type d'événement (ex: `mariage_moderne`, `seminaire`, `conference`)
- `event_category` : Catégorie (ex: `prive_familial`, `corporate_professionnel`)
- `title` : Titre de l'événement
- `event_date` : Date de l'événement
- `guest_count` : Nombre d'invités
- `budget_min` et `budget_max` : Budget estimé
- `style` : Style d'événement (ex: `moderne`, `luxe`)

**Données créées :**
- `events` : Nouvel événement avec statut `planification`

**Notification :**
- Si créé par un client, une notification est envoyée aux admins

### 2.2 Liste des événements

**Route :** `GET /events-get-events`

**Flux :**
1. **Client** : Voit uniquement ses propres événements
2. **Admin** : Voit tous les événements

**Filtres disponibles :**
- `status` : Filtrer par statut (`planification`, `confirme`, `en_preparation`, `en_cours`, `termine`, `annule`)
- `event_type` : Filtrer par type d'événement
- `page` et `limit` : Pagination

### 2.3 Détails d'un événement

**Route :** `GET /events-get-event-details?event_id=<id>`

**Flux :**
1. Récupère l'événement avec toutes ses relations :
   - Informations du lieu (venue)
   - Informations du client et de son profil
   - Tous les devis associés avec leurs items
   - Tous les services ajoutés à l'événement
   - Statistiques des invités (RSVP)
   - Historique des paiements

**Permissions :**
- **Client** : Peut voir uniquement ses propres événements
- **Admin** : Peut voir tous les événements

### 2.4 Mise à jour d'un événement

**Route :** `POST /events-update-event`

**Flux :**
1. **Client** : Peut mettre à jour uniquement ses propres événements
2. **Admin** : Peut mettre à jour n'importe quel événement

**Champs modifiables :**
- Titre, description, date, heure
- Nombre d'invités
- Budget, style
- Statut (avec restrictions selon l'état actuel)

### 2.5 Suppression d'un événement

**Route :** `DELETE /events-delete-event`

**Flux :**
1. Vérifie qu'aucun devis accepté n'existe pour cet événement
2. Si aucun devis accepté, l'événement est supprimé (cascade sur les relations)

**Permissions :**
- **Client** : Peut supprimer uniquement ses propres événements
- **Admin** : Peut supprimer n'importe quel événement

---

## 🏢 3. GESTION DES LIEUX (VENUES)

### 3.1 Liste des lieux disponibles

**Route :** `GET /venues-get-venues`

**Flux :**
1. Récupère tous les lieux disponibles (fonction publique)
2. Filtres disponibles :
   - `city` : Filtrer par ville
   - `min_capacity` et `max_capacity` : Filtrer par capacité
   - `date` : Vérifier la disponibilité pour une date spécifique
   - `is_available` : Filtrer par disponibilité générale

**Note :** Les lieux sont créés directement en SQL (pas de fonction Edge pour la création)

### 3.2 Vérification de disponibilité

**Route :** `GET /venues-check-availability?venue_id=<id>&date=<date>`

**Flux :**
1. Vérifie si le lieu est disponible en général (`is_available`)
2. Vérifie la disponibilité pour la date spécifique dans `venue_availability`
3. Vérifie si un événement existe déjà pour ce lieu à cette date
4. Retourne `is_available: true/false` avec les détails

### 3.3 Réservation d'un lieu

**Route :** `POST /venues-reserve-venue`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Vérifie la disponibilité du lieu pour la date de l'événement
3. Met à jour l'événement avec le `venue_id`
4. Crée une entrée dans `venue_availability` si nécessaire

**Données requises :**
- `event_id` : ID de l'événement
- `venue_id` : ID du lieu à réserver
- `date` : Optionnel (utilise `event.event_date` si non fourni)

---

## 🎨 4. GESTION DES SERVICES

### 4.1 Liste des services disponibles

**Route :** `GET /services-get-services`

**Flux :**
1. Récupère tous les services actifs (fonction publique)
2. Filtres disponibles :
   - `service_type` : Filtrer par type de service
   - `is_active` : Filtrer par statut actif/inactif

**Types de services :**
- `reservation_lieu`
- `traiteur_boissons`
- `decoration_design`
- `animations_artistes`
- `photo_video`
- `gestion_invites`
- `location_materiel`
- `communication_marketing`
- `streaming_hybride`

**Note :** Les services sont créés directement en SQL (pas de fonction Edge pour la création)

### 4.2 Ajouter un service à un événement

**Route :** `POST /services-add-service-to-event`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Vérifie que le service existe et est actif
3. Vérifie qu'un prestataire est fourni (optionnel)
4. Crée une entrée dans `event_services` avec :
   - Configuration personnalisée
   - Quantité
   - Prix unitaire et total

**Données requises :**
- `event_id` : ID de l'événement
- `service_id` : ID du service
- `provider_id` : ID du prestataire (optionnel)
- `quantity` : Quantité
- `unit_price` : Prix unitaire
- `configuration` : Configuration personnalisée (JSON)

**Données créées :**
- `event_services` : Service ajouté à l'événement

### 4.3 Retirer un service d'un événement

**Route :** `DELETE /services-remove-service-from-event`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Vérifie que le service est bien associé à l'événement
3. Supprime l'entrée dans `event_services`

---

## 💰 5. GESTION DES DEVIS

### 5.1 Création d'un devis

**Route :** `POST /quotes-create-quote`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent créer des devis
2. Vérifie que l'événement existe
3. Génère un numéro de devis unique (format : `DEV-YYYY-XXXX`)
4. Calcule les totaux (sous-total, TVA, remise, total)
5. Crée le devis dans `quotes` avec statut `brouillon`
6. Crée les lignes de devis dans `quote_items`

**Données requises :**
- `event_id` : ID de l'événement
- `items` : Tableau d'items avec :
  - `description` : Description de l'item
  - `quantity` : Quantité
  - `unit_price` : Prix unitaire
  - `total_price` : Prix total
- `validity_date` : Date de validité du devis
- `notes` : Notes optionnelles

**Données créées :**
- `quotes` : Nouveau devis avec statut `brouillon`
- `quote_items` : Lignes de devis

**Statuts de devis :**
- `brouillon` : Devis en cours de création
- `en_attente` : Devis en attente d'envoi
- `en_cours_revision` : Devis en cours de révision
- `envoye` : Devis envoyé au client
- `accepte` : Devis accepté par le client
- `refuse` : Devis refusé par le client
- `expire` : Devis expiré

### 5.2 Envoi d'un devis

**Route :** `POST /quotes-send-quote`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent envoyer des devis
2. Vérifie que le devis existe et n'a pas déjà été envoyé
3. Vérifie que le devis peut être envoyé (statut `brouillon` ou `en_attente`)
4. Met à jour le devis :
   - Statut : `envoye`
   - `sent_at` : Date d'envoi
5. Crée une notification pour le client

**Données requises :**
- `quote_id` : ID du devis à envoyer

**Données modifiées :**
- `quotes` : Statut mis à jour à `envoye`
- `notifications` : Notification créée pour le client

### 5.3 Récupération d'un devis

**Route :** `GET /quotes-get-quote?quote_id=<id>`

**Flux :**
1. **Client** : Peut voir uniquement les devis de ses propres événements
2. **Admin** : Peut voir tous les devis
3. Récupère le devis avec :
   - Informations de l'événement
   - Informations du client propriétaire
   - Toutes les lignes de devis (quote_items)
   - Contrats associés (si existants)

**Permissions :**
- Vérifie que l'événement associé au devis appartient au client connecté

### 5.4 Accepter un devis

**Route :** `POST /quotes-accept-quote`

**Flux :**
1. **Client uniquement** : Seuls les clients peuvent accepter leurs devis
2. Vérifie que le devis peut être accepté :
   - Statut : `envoye` ou `brouillon`
   - Date de validité non expirée
3. Met à jour le devis :
   - Statut : `accepte`
   - `accepted_at` : Date d'acceptation
4. Crée un contrat automatiquement :
   - Génère un numéro de contrat (format : `CON-YYYYMMDD-XXX`)
   - Contenu basé sur le devis
5. Met à jour l'événement :
   - Statut : `confirme`
6. Crée une notification pour les admins

**Données requises :**
- `quote_id` : ID du devis à accepter
- `contract_content` : Contenu du contrat (optionnel)

**Données créées/modifiées :**
- `quotes` : Statut mis à jour à `accepte`
- `contracts` : Nouveau contrat créé
- `events` : Statut mis à jour à `confirme`
- `notifications` : Notification créée pour les admins

### 5.5 Rejeter un devis

**Route :** `POST /quotes-reject-quote`

**Flux :**
1. **Client uniquement** : Seuls les clients peuvent rejeter leurs devis
2. Vérifie que le devis peut être rejeté :
   - Statut : pas `accepte` ou `refuse`
3. Met à jour le devis :
   - Statut : `refuse`
   - `rejected_at` : Date de rejet
   - `rejection_reason` : Raison du rejet (optionnel)
4. Crée une notification pour les admins

**Données requises :**
- `quote_id` : ID du devis à rejeter
- `reason` : Raison du rejet (optionnel)

---

## 👥 6. GESTION DES INVITÉS

### 6.1 Ajouter des invités

**Route :** `POST /guests-add-guests`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Valide les données de chaque invité :
   - Prénom et nom requis
   - Email ou téléphone requis
3. Crée les invités dans `guests` avec statut RSVP `pending`

**Données requises :**
- `event_id` : ID de l'événement
- `guests` : Tableau d'invités avec :
  - `first_name` : Prénom
  - `last_name` : Nom
  - `email` : Email (optionnel)
  - `phone` : Téléphone (optionnel)
  - `category` : Catégorie (ex: `guest`, `vip`)
  - `dietary_restrictions` : Restrictions alimentaires (optionnel)

**Données créées :**
- `guests` : Nouveaux invités avec statut RSVP `pending`

### 6.2 Envoyer des invitations

**Route :** `POST /guests-send-invitations`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Récupère tous les invités de l'événement (ou ceux spécifiés dans `guest_ids`)
3. Pour chaque invité avec email ou téléphone :
   - Génère un token unique
   - Crée une invitation dans `invitations`
   - Type : `email` ou `sms` selon les informations disponibles
4. **TODO** : Envoi réel des emails/SMS avec lien RSVP

**Données requises :**
- `event_id` : ID de l'événement
- `guest_ids` : IDs des invités spécifiques (optionnel, sinon tous les invités)
- `custom_message` : Message personnalisé (optionnel)

**Données créées :**
- `invitations` : Invitations créées avec tokens uniques

### 6.3 RSVP (Réponse d'invitation)

**Route :** `POST /guests-rsvp`

**Flux :**
1. **Fonction publique** : Pas besoin d'authentification (utilise le token d'invitation)
2. Trouve l'invitation avec le token fourni
3. Met à jour le statut RSVP de l'invité :
   - `accepted` : Invité accepte
   - `declined` : Invité refuse
   - `maybe` : Invité hésite
4. Met à jour la date RSVP
5. Met à jour l'invitation (`opened_at`)

**Données requises :**
- `token` : Token d'invitation unique
- `rsvp_status` : Statut RSVP (`accepted`, `declined`, `maybe`)
- `dietary_restrictions` : Restrictions alimentaires (optionnel, si accepte)
- `reason` : Raison (optionnel, si refuse)

**Statuts RSVP acceptés :**
- `accepted` / `accepte` / `accept` → Normalisé en `accepted`
- `declined` / `refused` / `refuse` → Normalisé en `declined`
- `maybe` / `peut-etre` → Normalisé en `maybe`

### 6.4 Liste des invités

**Route :** `GET /guests-get-guest-list?event_id=<id>`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Récupère tous les invités de l'événement
3. Calcule les statistiques RSVP :
   - Total d'invités
   - Nombre par statut (pending, accepted, declined, maybe)

**Filtres disponibles :**
- `rsvp_status` : Filtrer par statut RSVP
- `category` : Filtrer par catégorie

---

## 💳 7. GESTION DES PAIEMENTS

### 7.1 Créer une intention de paiement

**Route :** `POST /payments-create-payment-intent`

**Flux :**
1. Vérifie que l'événement existe et appartient au client (ou admin)
2. Vérifie s'il existe un devis accepté pour cet événement
3. Génère un ID de transaction unique
4. Crée une intention de paiement dans `payments` avec statut `en_attente`

**Données requises :**
- `event_id` : ID de l'événement
- `amount` : Montant à payer
- `payment_type` : Type de paiement (`acompte`, `echeance`, `solde`, `remboursement`)
- `payment_method` : Méthode de paiement (optionnel)
- `due_date` : Date d'échéance (optionnel, 30 jours par défaut)

**Types de paiement normalisés :**
- `partial` / `acompte` / `deposit` → `acompte`
- `installment` / `echeance` → `echeance`
- `final` / `solde` / `balance` → `solde`
- `refund` / `remboursement` → `remboursement`

**Statuts de paiement :**
- `en_attente` : Paiement en attente
- `acompte_recu` : Acompte reçu
- `partiellement_paye` : Partiellement payé
- `paye` : Totalement payé
- `rembourse` : Remboursé
- `annule` : Annulé

### 7.2 Confirmer un paiement

**Route :** `POST /payments-confirm-payment`

**Flux :**
1. Vérifie que le paiement existe et appartient au client (ou admin)
2. Vérifie que le paiement peut être confirmé :
   - Statut : pas `paye` ou `annule`
3. Met à jour le paiement :
   - Statut : `paye`
   - `paid_at` : Date de paiement
   - `payment_method` : Méthode de paiement
   - `receipt_url` : URL de la preuve de paiement
   - `transaction_id` : ID de transaction
4. Crée une notification pour les admins

**Données requises :**
- `payment_id` ou `payment_intent_id` : ID du paiement
- `transaction_id` : ID de transaction (optionnel)
- `payment_proof_url` ou `receipt_url` : URL de la preuve (optionnel)
- `payment_method` : Méthode de paiement (optionnel)

**TODO :** Intégration avec un service de paiement (Stripe, PayPal, etc.)

### 7.3 Historique des paiements

**Route :** `GET /payments-get-payment-history?event_id=<id>`

**Flux :**
1. **Client** : Voit uniquement les paiements de ses propres événements
2. **Admin** : Voit tous les paiements
3. Récupère tous les paiements avec :
   - Informations de l'événement
   - Informations du devis associé
4. Calcule les statistiques :
   - Total des paiements
   - Montant payé
   - Montant en attente
   - Montant en retard

**Filtres disponibles :**
- `event_id` : Filtrer par événement
- `status` : Filtrer par statut

---

## 💬 8. MESSAGERIE

### 8.1 Envoyer un message

**Route :** `POST /messages-send-message`

**Flux :**
1. Vérifie que l'expéditeur est authentifié
2. Vérifie que le destinataire existe
3. Vérifie que l'événement existe (si fourni)
4. Crée un message dans `messages` avec :
   - `sender_id` : ID de l'expéditeur
   - `recipient_id` : ID du destinataire
   - `event_id` : ID de l'événement (optionnel)
   - `subject` : Sujet (optionnel)
   - `content` : Contenu du message
   - `is_read` : `false` par défaut

**Données requises :**
- `recipient_id` : ID du destinataire (profile_id)
- `content` : Contenu du message
- `event_id` : ID de l'événement (optionnel)
- `subject` : Sujet (optionnel)
- `parent_message_id` : ID du message parent (optionnel, pour les réponses)

**Données créées :**
- `messages` : Nouveau message

### 8.2 Récupérer les messages

**Route :** `GET /messages-get-messages`

**Flux :**
1. Récupère tous les messages où l'utilisateur est expéditeur ou destinataire
2. Inclut les informations de l'expéditeur et du destinataire (profiles)
3. Inclut les informations de l'événement (si associé)

**Filtres disponibles :**
- `event_id` : Filtrer par événement
- `other_user_id` : Filtrer pour une conversation spécifique
- `is_read` : Filtrer par statut de lecture
- `page` et `limit` : Pagination

### 8.3 Marquer un message comme lu

**Route :** `POST /messages-mark-as-read`

**Flux :**
1. Met à jour le message (ou plusieurs messages) :
   - `is_read` : `true`
   - `read_at` : Date de lecture

**Données requises :**
- `message_id` ou `message_ids` : ID(s) du/des message(s)

---

## 🔔 9. NOTIFICATIONS

### 9.1 Créer une notification

**Route :** `POST /notifications-create-notification`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent créer des notifications
2. Crée une notification dans `notifications` :
   - `user_id` : ID de l'utilisateur (ou `null` pour notification globale à tous les admins)
   - `event_id` : ID de l'événement (optionnel)
   - `type` : Type de notification
   - `title` : Titre
   - `message` : Message
   - `is_read` : `false` par défaut

**Types de notifications :**
- `quote_sent` : Devis envoyé
- `quote_accepted` : Devis accepté
- `quote_rejected` : Devis rejeté
- `payment_received` : Paiement reçu
- `event_created` : Nouvel événement créé
- Etc.

### 9.2 Marquer une notification comme lue

**Route :** `POST /notifications-mark-notification-read`

**Flux :**
1. Met à jour la notification (ou plusieurs notifications) :
   - `is_read` : `true`
   - `read_at` : Date de lecture

**Données requises :**
- `notification_id` ou `notification_ids` : ID(s) de la/des notification(s)

---

## 👨‍💼 10. FONCTIONS ADMINISTRATEUR

### 10.1 Statistiques du dashboard

**Route :** `GET /admin-dashboard-stats`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent accéder
2. Calcule les statistiques globales :
   - Nombre total d'événements
   - Événements à venir
   - Événements terminés
   - Nombre total de devis
   - Devis en attente
   - Devis acceptés
   - Revenus totaux (paiements payés)
   - Nombre total de clients

**Filtres disponibles :**
- `start_date` et `end_date` : Filtrer par période

### 10.2 Tous les événements

**Route :** `GET /admin-get-all-events`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent accéder
2. Récupère tous les événements avec :
   - Informations du client et de son profil
   - Informations du lieu
   - Devis associés

**Filtres disponibles :**
- `status` : Filtrer par statut
- `event_type` : Filtrer par type
- `start_date` et `end_date` : Filtrer par période
- `client_id` : Filtrer par client
- `page` et `limit` : Pagination

### 10.3 Assigner un prestataire

**Route :** `POST /admin-assign-provider`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent assigner des prestataires
2. Vérifie que le service événement existe
3. Vérifie que le prestataire existe et est actif
4. Met à jour `event_services` avec le `provider_id`

**Données requises :**
- `event_service_id` : ID du service événement
- `provider_id` : ID du prestataire à assigner

### 10.4 Générer une facture

**Route :** `POST /admin-generate-invoice`

**Flux :**
1. **Admin uniquement** : Seuls les administrateurs peuvent générer des factures
2. Vérifie que le devis existe et est accepté
3. Génère un document PDF de facture
4. Crée une entrée dans `documents` avec :
   - `document_type` : `invoice`
   - `quote_id` : ID du devis
   - `event_id` : ID de l'événement
   - `file_url` : URL du PDF généré

**Données requises :**
- `quote_id` : ID du devis accepté
- `event_id` : ID de l'événement (optionnel, récupéré depuis le devis)

**TODO :** Génération réelle du PDF

---

## 🌐 11. FONCTIONS PUBLIQUES

### 11.1 Articles de blog

**Route :** `GET /public-get-blog-posts`

**Flux :**
1. **Fonction publique** : Pas besoin d'authentification
2. Récupère tous les articles de blog publiés
3. Filtres disponibles :
   - `category` : Filtrer par catégorie
   - `tags` : Filtrer par tags
   - `page` et `limit` : Pagination

### 11.2 Témoignages

**Route :** `GET /public-get-testimonials`

**Flux :**
1. **Fonction publique** : Pas besoin d'authentification
2. Récupère tous les témoignages approuvés et mis en avant
3. Filtres disponibles :
   - `is_featured` : Filtrer les témoignages mis en avant
   - `rating` : Filtrer par note
   - `page` et `limit` : Pagination

### 11.3 Formulaire de contact

**Route :** `POST /public-submit-contact-form`

**Flux :**
1. **Fonction publique** : Pas besoin d'authentification
2. Valide les données du formulaire
3. **TODO** : Envoi d'email à l'équipe Empire Events
4. Retourne un message de confirmation

**Données requises :**
- `name` : Nom
- `email` : Email
- `subject` : Sujet
- `message` : Message

---

## 🔄 FLUX COMPLET TYPIQUE

### Scénario 1 : Client crée un événement et reçoit un devis

1. **Client s'inscrit** → `POST /auth-register`
2. **Client se connecte** → `POST /auth-login` → Obtient un token
3. **Client crée un événement** → `POST /events-create-event`
4. **Client réserve un lieu** → `POST /venues-reserve-venue`
5. **Client ajoute des services** → `POST /services-add-service-to-event`
6. **Admin crée un devis** → `POST /quotes-create-quote`
7. **Admin envoie le devis** → `POST /quotes-send-quote` → Notification au client
8. **Client consulte le devis** → `GET /quotes-get-quote`
9. **Client accepte le devis** → `POST /quotes-accept-quote` → Contrat créé, événement confirmé
10. **Client crée une intention de paiement** → `POST /payments-create-payment-intent`
11. **Client confirme le paiement** → `POST /payments-confirm-payment`
12. **Client ajoute des invités** → `POST /guests-add-guests`
13. **Client envoie des invitations** → `POST /guests-send-invitations`
14. **Invités répondent (RSVP)** → `POST /guests-rsvp` (publique, avec token)

### Scénario 2 : Admin gère plusieurs événements

1. **Admin se connecte** → `POST /auth-login` → Obtient un token admin
2. **Admin consulte le dashboard** → `GET /admin-dashboard-stats`
3. **Admin voit tous les événements** → `GET /admin-get-all-events`
4. **Admin crée un devis pour un événement** → `POST /quotes-create-quote`
5. **Admin assigne un prestataire** → `POST /admin-assign-provider`
6. **Admin génère une facture** → `POST /admin-generate-invoice`

---

## 🔐 GESTION DES PERMISSIONS

### Rôles utilisateurs

- **`client`** : Client standard
  - Peut créer et gérer ses propres événements
  - Peut accepter/rejeter ses devis
  - Peut gérer ses invités et paiements
  - Voit uniquement ses propres données

- **`admin`** : Administrateur
  - Peut voir et gérer tous les événements
  - Peut créer et envoyer des devis
  - Peut assigner des prestataires
  - Peut générer des factures
  - Accès complet au dashboard

- **`super_admin`** : Super administrateur
  - Mêmes permissions que `admin` + accès système complet

- **`prestataire`** : Prestataire (partenaire)
  - Peut voir les événements où il est assigné
  - Peut mettre à jour ses informations

### Vérification des permissions

Toutes les fonctions vérifient :
1. **Authentification** : L'utilisateur est-il connecté ?
2. **Profil** : Le profil existe-t-il dans `profiles` ?
3. **Rôle** : Le rôle permet-il cette action ?
4. **Propriété** : Pour les clients, l'entité leur appartient-elle ?

**Note importante** : Pour éviter les problèmes de RLS (Row Level Security), toutes les fonctions utilisent `supabaseAdmin` (avec `SUPABASE_SERVICE_ROLE_KEY`) pour :
- Récupérer les profils
- Récupérer les clients
- Effectuer des requêtes complexes avec JOINs
- Insérer/mettre à jour/supprimer des données

---

## 📊 STRUCTURE DES DONNÉES

### Relations principales

```
profiles (1) ──< (1) clients ──< (N) events
                                           │
                                           ├──< (N) quotes
                                           │      └──< (N) quote_items
                                           │      └──< (1) contracts
                                           │
                                           ├──< (N) event_services
                                           │      ├──> (1) services
                                           │      └──> (1) providers
                                           │
                                           ├──< (N) guests
                                           │      └──< (1) invitations
                                           │
                                           ├──< (N) payments
                                           │
                                           └──< (N) messages
```

### Tables principales

- **`profiles`** : Profils utilisateurs (liés à `auth.users`)
- **`clients`** : Informations clients (extension de `profiles`)
- **`events`** : Événements créés par les clients
- **`venues`** : Lieux disponibles pour les événements
- **`services`** : Catalogue de services
- **`providers`** : Prestataires partenaires
- **`event_services`** : Services ajoutés à un événement
- **`quotes`** : Devis générés pour les événements
- **`quote_items`** : Lignes de devis
- **`contracts`** : Contrats générés à partir des devis acceptés
- **`payments`** : Paiements effectués
- **`guests`** : Invités aux événements
- **`invitations`** : Invitations envoyées aux invités
- **`messages`** : Messages entre clients et admins
- **`notifications`** : Notifications système
- **`documents`** : Documents (factures, contrats, etc.)

---

## 🚨 GESTION DES ERREURS

### Erreurs courantes

1. **"Profil introuvable"**
   - Cause : Le profil n'existe pas dans `profiles` pour cet utilisateur
   - Solution : Vérifier que le profil a été créé lors de l'inscription

2. **"Accès non autorisé"**
   - Cause : L'utilisateur essaie d'accéder à une ressource qui ne lui appartient pas
   - Solution : Vérifier que l'entité appartient bien au client connecté

3. **"Invalid JWT"**
   - Cause : Le token JWT est expiré ou invalide
   - Solution : Se reconnecter pour obtenir un nouveau token

4. **"infinite recursion detected in policy for relation 'profiles'"**
   - Cause : Problème de RLS avec les JOINs complexes
   - Solution : Utiliser `supabaseAdmin` pour contourner RLS (déjà implémenté)

5. **"invalid input value for enum"**
   - Cause : Valeur enum incorrecte
   - Solution : Utiliser les valeurs exactes définies dans le schéma SQL

### Codes de statut HTTP

- **200** : Succès
- **201** : Créé avec succès
- **400** : Erreur de requête (données invalides, permissions, etc.)
- **401** : Non authentifié (token manquant ou invalide)
- **403** : Accès interdit (permissions insuffisantes)
- **404** : Ressource introuvable
- **500** : Erreur serveur

---

## 📝 NOTES IMPORTANTES

1. **Tokens JWT** : Expirent après 1 heure. Se reconnecter pour obtenir un nouveau token.

2. **RLS (Row Level Security)** : Toutes les fonctions utilisent `supabaseAdmin` pour éviter les problèmes de RLS avec les JOINs complexes.

3. **IDs de référence** : 
   - `clients.id` (UUID) est utilisé pour référencer les clients dans `events.client_id`
   - `clients.profile_id` (UUID) référence `profiles.id`
   - Ne pas confondre `client.id` et `client.profile_id`

4. **Statuts et Enums** : Tous les statuts et types doivent correspondre exactement aux valeurs définies dans le schéma SQL (voir `bd.sql`).

5. **Création de données** : Certaines entités (venues, services, providers) sont créées directement en SQL car il n'y a pas de fonctions Edge pour leur création.

6. **Transactions** : Les opérations critiques (acceptation de devis, création de contrats) devraient utiliser des transactions PostgreSQL pour garantir l'atomicité (TODO).

---

## 🔗 RÉFÉRENCES

- **Schéma SQL** : `bd.sql`
- **Valeurs Enum** : `VALEURS-ENUM-CORRECTES.md`
- **Fichier de test** : `test-data-complete.http`
- **Données SQL de test** : `sql-test-data.sql`

---

*Document généré le 22 décembre 2025*

