# 📦 Mise à Jour — Catalogue Dynamique & Notifications Email
**Date :** 21 Mai 2026  
**Projet :** Empire Events  
**Scope :** Frontend (`C:\Projets\Empire_Events`) + Backend (`C:\Projets\empire-edge-backend`)

---

## 🎯 Objectif de cette mise à jour

Transformer le formulaire de demande de devis en un système **100% dynamique** géré depuis le panel admin, et ajouter des **notifications email automatiques** à chaque étape clé du workflow.

---

## 🆕 Nouveautés Implémentées

### 1. Emails automatiques (Nodemailer / Gmail SMTP)

Trois nouveaux déclencheurs email ont été intégrés :

| Déclencheur | Destinataire | Template |
|---|---|---|
| Client soumet un devis | **Client** | `devis_recu` — Confirmation de réception, ton rassurant |
| Client soumet un devis | **Admin** (`mamadoubayoula240@gmail.com`) | `admin_nouveau_devis` — Résumé complet du devis |
| Admin valide un devis | **Client** | `devis_approuve` — Annonce officielle de l'approbation |

**Fichiers modifiés :**
- `Empire_Events/src/components/devis/DevisForm.tsx` → Appel à `/api/send-email` après soumission
- `Empire_Events/src/app/api/send-email/route.ts` → Adresse admin fixée à `mamadoubayoula240@gmail.com`

**Configuration SMTP** (déjà en place dans `.env.local`) :
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youlamamadouba240@gmail.com
SMTP_PASS=piizbmcexpazfrud
ADMIN_EMAIL=mamadoubayoula240@gmail.com   ← (optionnel, override de l'adresse admin)
```

---

### 2. Catalogue Dynamique (Types d'événements / Services / Préférences)

#### Avant (codé en dur)
Les types d'événements (Mariage, Anniversaire...), les services (Traiteur, Salle...) et les préférences (Cuisine Africaine...) étaient directement écrits dans le code TypeScript frontend. Impossible de les modifier sans redéploiement.

#### Après (dynamique via backend)
Tout est stocké dans la table `settings` de Supabase (clé : `quote_form_catalog`) et récupéré au chargement du formulaire.

**Structure JSON du catalogue :**
```json
{
  "eventTypes": [
    { "id": "mariage_moderne", "label": "Mariage Moderne" },
    { "id": "anniversaire_adulte", "label": "Anniversaire Adulte" },
    ...
  ],
  "services": [
    {
      "id": "catering",
      "name": "Traiteur",
      "eventTypes": ["mariage_moderne", "anniversaire_adulte", "seminaire"]
    },
    ...
  ],
  "preferences": {
    "catering": {
      "label": "Type de repas souhaité",
      "options": ["Cuisine Africaine", "Cuisine Européenne", "Mixte", "Buffet", "Autre"],
      "allowOther": true
    },
    "decor": {
      "label": "Style de décoration",
      "options": ["Classique / Épuré", "Traditionnel", "Moderne / Glamour", "Autre"],
      "allowOther": true
    }
  }
}
```

---

### 3. Nouvelle Edge Function : `admin/manage-catalog`

**Fichier :** `supabase/functions/admin/manage-catalog/index.ts`

| Méthode | Rôle |
|---|---|
| `GET` | Récupère le catalogue actuel depuis la table `settings` |
| `POST` | Sauvegarde/met à jour le catalogue (`upsert`) |

Cette fonction est utilisée par :
- Le **formulaire client** (`/devis`) pour charger les types d'événements, services et préférences
- La **page admin Catalogue** pour modifier la configuration

---

### 4. Nouvelle Page Admin : `/admin/catalog`

**Fichier :** `Empire_Events/src/app/admin/catalog/page.tsx`

Interface d'administration permettant de :
- Visualiser le catalogue JSON complet
- Modifier directement les types d'événements, services et préférences
- Sauvegarder les changements en temps réel dans Supabase

> ⚡ Dès qu'un changement est sauvegardé, il est **immédiatement visible** côté client sans aucun redéploiement.

---

### 5. Formulaire Client Mis à Jour (`/devis`)

**Étape 1 — Type d'événement** (`Step1GeneralInfo.tsx`)
- Les types d'événements sont désormais chargés **depuis le backend** via le catalogue.
- Fallback sur des données statiques si le backend est indisponible.

**Étape 2 — Services** (`Step2Services.tsx`)
- La liste des services est filtrée **selon le type d'événement sélectionné** (via le champ `eventTypes` du catalogue).
- Les **sous-options / préférences** (ex: "Type de repas souhaité") sont également chargées depuis le catalogue.
- Option **"Autre"** avec champ texte libre disponible pour chaque service.

**Soumission** (`DevisForm.tsx`)
- Les `services_preferences` (choix du client) sont inclus dans le payload envoyé à Supabase.
- Deux emails sont automatiquement envoyés après succès : confirmation client + notification admin.

---

### 6. Nettoyage Backend : `quotes-accept-quote`

La logique d'envoi d'email via l'API **Resend** a été retirée de l'Edge Function (elle causait des erreurs car la clé API n'était pas configurée). L'email d'approbation est désormais géré exclusivement par le **frontend via Nodemailer** (`/api/send-email`).

---

### 7. Fix TypeScript — Erreurs Deno dans VS Code

| Problème | Solution |
|---|---|
| `Cannot find name 'Deno'` | Ajout de `declare const Deno: any;` dans les fichiers concernés |
| `Cannot find module 'https://esm.sh/...'` | `// @ts-nocheck` + exclusion de `supabase/functions` dans `tsconfig.json` |

> ✅ **Solution permanente recommandée** : Installer l'extension VS Code **`denoland.vscode-deno`** (`Ctrl+Shift+X` → rechercher "Deno"). Elle gère nativement les imports URL Deno.

---

## 🚀 Déploiement des Edge Functions

### ⚠️ Prérequis : Configurer le token Supabase
```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_VOTRE_TOKEN_ICI"
```

---

### Fonctions à déployer

#### 1. `admin/manage-catalog` — **NOUVELLE fonction** (obligatoire)
C'est la fonction qui permet au formulaire client de charger les données dynamiquement.
```powershell
.\deploy-ps.ps1 -Functions @("admin/manage-catalog")
```

#### 2. `quotes-accept-quote` — **MODIFIÉE** (recommandé)
Nettoyage de la logique Resend défaillante.
```powershell
.\deploy-ps.ps1 -Functions @("quotes-accept-quote")
```

#### 3. Tout déployer d'un coup
```powershell
.\deploy-ps.ps1 -Functions @("admin/manage-catalog", "quotes-accept-quote")
```

---

## 📋 Checklist de validation post-déploiement

- [ ] Aller sur `/admin/catalog` → Vérifier que la page charge et affiche le JSON
- [ ] Cliquer **Sauvegarder** pour initialiser le catalogue en base de données
- [ ] Aller sur `/devis` → Vérifier que les types d'événements s'affichent (venant du backend)
- [ ] Sélectionner un type d'événement → Les services correspondants doivent apparaître
- [ ] Sélectionner un service (ex: Traiteur) → La sous-option doit apparaître
- [ ] Sélectionner "Autre" → Le champ texte libre doit s'afficher
- [ ] Soumettre un devis complet → Vérifier la réception de l'email client
- [ ] Vérifier la réception de l'email admin sur `mamadoubayoula240@gmail.com`
- [ ] Dans `/admin/quotes/[id]` → Valider un devis → Vérifier l'email d'approbation client

---

## 📁 Fichiers Modifiés / Créés

### Frontend (`Empire_Events`)
| Fichier | Statut | Description |
|---|---|---|
| `src/components/devis/DevisForm.tsx` | ✏️ Modifié | Fetch catalogue + envoi emails post-soumission |
| `src/components/devis/steps/Step1GeneralInfo.tsx` | ✏️ Modifié | Types d'événements depuis catalog prop |
| `src/components/devis/steps/Step2Services.tsx` | ✏️ Modifié | Services/préférences dynamiques depuis catalog prop |
| `src/app/api/send-email/route.ts` | ✏️ Modifié | Email admin → `mamadoubayoula240@gmail.com` par défaut |
| `src/app/admin/catalog/page.tsx` | 🆕 Créé | Page admin gestion catalogue |
| `src/lib/api/endpoints.ts` | ✏️ Modifié | Ajout `admin.manageCatalog` |

### Backend (`empire-edge-backend`)
| Fichier | Statut | Description |
|---|---|---|
| `supabase/functions/admin/manage-catalog/index.ts` | 🆕 Créé | Edge Function GET/POST catalogue |
| `supabase/functions/quotes-accept-quote/index.ts` | ✏️ Modifié | Retrait logique email Resend |
| `supabase/functions/admin/assign-provider/index.ts` | ✏️ Modifié | Fix TS (`@ts-nocheck`, `declare Deno`) |
| `tsconfig.json` | ✏️ Modifié | Exclusion `supabase/functions` du compiler Node TS |
| `.vscode/settings.json` | ✅ Inchangé | Déjà configuré pour Deno |
