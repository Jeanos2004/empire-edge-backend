-- SQL pour créer le profil admin pour l'utilisateur créé
-- Exécutez ce SQL dans Supabase: https://app.supabase.com/project/qjfygjtondljywhbqbfj/sql/new

INSERT INTO profiles (
    id,
    role,
    first_name,
    last_name,
    phone
) VALUES (
    'c6b31fc8-4a2e-402c-b7e0-8827c6ce3d3e',  -- ID de l'utilisateur créé
    'admin',
    'Admin',
    'Empire',
    '+224612345678'
)
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    first_name = 'Admin',
    last_name = 'Empire',
    phone = '+224612345678';

