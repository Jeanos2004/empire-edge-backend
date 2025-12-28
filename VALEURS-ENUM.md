# 📋 Valeurs Enum Valides

Ce document liste les valeurs enum valides pour les différents champs de la base de données.

## 🎯 event_type (Type d'événement)

Les valeurs valides pour `event_type` sont généralement en français (minuscules) :
- `mariage`
- `seminaire` (ou `séminaire` selon le schéma)
- `conference` (ou `conférence` selon le schéma)
- `anniversaire`
- `concert`
- `soiree` (ou `soirée`)
- `lancement`
- `formation`
- `reunion` (ou `réunion`)

## 📂 event_category (Catégorie d'événement)

Les valeurs valides pour `event_category` sont généralement en anglais (minuscules) :
- `ceremony` (cérémonie)
- `professional` (professionnel)
- `personal` (personnel)
- `corporate` (entreprise)
- `social` (social)
- `cultural` (culturel)
- `sports` (sportif)
- `educational` (éducatif)

## ⚠️ Note Importante

Si vous obtenez une erreur `invalid input value for enum`, cela signifie que la valeur utilisée n'est pas dans la liste des valeurs autorisées par l'enum PostgreSQL.

Pour vérifier les valeurs exactes dans votre base de données, exécutez cette requête SQL dans Supabase :

```sql
-- Vérifier les valeurs de l'enum event_category
SELECT unnest(enum_range(NULL::event_category)) AS event_category;

-- Vérifier les valeurs de l'enum event_type
SELECT unnest(enum_range(NULL::event_type)) AS event_type;
```

## 🔧 Correction

Si vous utilisez des valeurs avec des accents ou en français, remplacez-les par les équivalents en anglais sans accents :

| Français | Anglais (Enum) |
|----------|----------------|
| cérémonie | ceremony |
| professionnel | professional |
| personnel | personal |
| entreprise | corporate |
| social | social |
| culturel | cultural |
| sportif | sports |
| éducatif | educational |

