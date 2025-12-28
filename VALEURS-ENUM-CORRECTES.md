# 📋 Valeurs Enum Correctes (Basées sur le Schéma SQL)

Ce document liste les valeurs enum **exactes** basées sur le schéma SQL fourni.

## 🎯 event_type (Type d'événement)

### Mariages
- `mariage_traditionnel`
- `mariage_religieux`
- `mariage_moderne`
- `mariage_plein_air`

### Fiançailles & Dot
- `fiancailles`
- `dot`

### Anniversaires
- `anniversaire_adulte`
- `anniversaire_enfant`
- `anniversaire_vip`

### Cérémonies Religieuses
- `bapteme`
- `nomination`
- `funerailles`
- `ceremonie_commemorative`

### Événements Privés
- `reception_privee`
- `garden_party`
- `baby_shower`
- `gender_reveal`
- `diner_gala_prive`

### Événements Professionnels
- `seminaire`
- `team_building`
- `retraite_entreprise`
- `conference`
- `panel`
- `workshop`
- `masterclass`
- `assemblee_generale`
- `inauguration`
- `lancement_produit`
- `soiree_entreprise`
- `afterwork`
- `gala_entreprise`
- `fete_fin_annee`
- `foire_commerciale`
- `exposition`
- `journee_portes_ouvertes`

### Événements Institutionnels
- `ceremonie_officielle`
- `sommet`
- `visite_presidentielle`
- `investiture`
- `rencontre_diplomatique`
- `reception_officielle`
- `colloque`
- `forum`
- `remise_diplomes`
- `ceremonie_universitaire`
- `conference_scientifique`

### Événements Associatifs
- `campagne_sensibilisation`
- `collecte_fonds`
- `gala_caritatif`
- `evenement_humanitaire`

### Événements Culturels & Artistiques
- `concert`
- `showcase`
- `festival_culturel`
- `exposition_art`
- `vernissage`
- `defile_mode`
- `spectacle_danse`
- `spectacle_theatre`
- `slam`
- `lecture_publique`
- `concours_poesie`

### Événements Sportifs
- `tournoi_sportif`
- `marathon`
- `course_populaire`
- `evenement_fitness`
- `evenement_wellness`
- `competition_esport`
- `activite_plein_air`

### Événements Publics
- `evenement_masse`
- `carnaval`
- `parade`
- `celebration_nationale`
- `fete_religieuse`
- `marche_public`
- `salon_public`

### Événements Innovants
- `evenement_hybride`
- `silent_party`
- `evenement_instagrammable`
- `evenement_ecoresponsable`
- `gaming_night`
- `soiree_geek`
- `popup_store`
- `evenement_ephemere`

## 📂 event_category (Catégorie d'événement)

- `prive_familial`
- `corporate_professionnel`
- `institutionnel_associatif`
- `culturel_artistique`
- `sportif_loisirs`
- `public_populaire`
- `innovant_moderne`

## 🎨 event_style (Style d'événement)

- `classique`
- `moderne`
- `vip`
- `ecoresponsable`
- `traditionnel`
- `contemporain`
- `luxe`
- `minimaliste`

## 📊 event_status (Statut d'événement)

- `planification`
- `confirme`
- `en_preparation`
- `en_cours`
- `termine`
- `annule`

## 💰 quote_status (Statut de devis)

- `brouillon`
- `en_attente`
- `en_cours_revision`
- `envoye`
- `accepte`
- `refuse`
- `expire`

## 💳 payment_status (Statut de paiement)

- `en_attente`
- `acompte_recu`
- `partiellement_paye`
- `paye`
- `rembourse`
- `annule`

## 💵 payment_type (Type de paiement)

- `acompte`
- `echeance`
- `solde`
- `remboursement`

## 👤 user_role (Rôle utilisateur)

- `client`
- `admin`
- `super_admin`
- `prestataire`

## 🔧 service_type (Type de service)

- `reservation_lieu`
- `traiteur_boissons`
- `decoration_design`
- `animations_artistes`
- `photo_video`
- `gestion_invites`
- `location_materiel`
- `communication_marketing`
- `streaming_hybride`

## ⚠️ Notes Importantes

1. **Toutes les valeurs sont en minuscules** avec des underscores (`_`) pour séparer les mots
2. **Pas d'accents** dans les valeurs enum
3. **Pas d'espaces** - utilisez des underscores
4. **Respectez exactement** l'orthographe (ex: `mariage_moderne` et non `mariage_modern`)

## 📝 Exemples d'Utilisation

```json
{
  "event_type": "mariage_moderne",
  "event_category": "prive_familial",
  "style": "luxe",
  "status": "planification"
}
```

```json
{
  "event_type": "conference",
  "event_category": "corporate_professionnel",
  "style": "moderne",
  "status": "confirme"
}
```

