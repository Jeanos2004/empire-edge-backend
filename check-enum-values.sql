-- Script pour vérifier les valeurs enum dans la base de données
-- À exécuter dans le SQL Editor de Supabase

-- Vérifier les valeurs de l'enum event_category
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'event_category'
ORDER BY e.enumsortorder;

-- Vérifier les valeurs de l'enum event_type
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'event_type'
ORDER BY e.enumsortorder;

-- Alternative: Vérifier la structure de la table events
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'events' 
AND column_name IN ('event_type', 'event_category');

