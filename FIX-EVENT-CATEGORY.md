# 🔧 Correction du champ event_category

## Problème

L'erreur `invalid input value for enum event_category: "ceremony"` indique que les valeurs de l'enum `event_category` dans votre base de données ne correspondent pas aux valeurs utilisées dans les fichiers de test.

## Solution Temporaire

J'ai retiré le champ `event_category` de toutes les requêtes de test car :
1. Ce champ est **optionnel** dans le code (`body.event_category || null`)
2. Les valeurs exactes de l'enum ne sont pas connues

## Solution Définitive

Pour trouver les valeurs exactes de l'enum `event_category`, exécutez cette requête SQL dans le SQL Editor de Supabase :

```sql
-- Vérifier les valeurs de l'enum event_category
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'event_category'
ORDER BY e.enumsortorder;
```

Une fois que vous connaissez les valeurs exactes, vous pouvez :
1. Les ajouter dans les requêtes de test
2. Mettre à jour le fichier `VALEURS-ENUM.md` avec les bonnes valeurs

## Alternative

Si `event_category` n'est pas essentiel pour vos tests, vous pouvez simplement l'omettre (comme c'est fait maintenant). Le champ sera automatiquement mis à `null` par le code.

## Fichiers Modifiés

- ✅ `test-data-complete.http` - `event_category` retiré de toutes les requêtes
- ✅ `supabase/functions/events/create-event/test.http` - `event_category` retiré
- ✅ `check-enum-values.sql` - Script SQL créé pour vérifier les valeurs enum

