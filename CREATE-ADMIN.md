# 👤 Créer un utilisateur Admin

## Méthode 1 : Script automatique (Recommandé)

```bash
./create-admin-user.sh
```

Le script vous demandera :
- Email de l'admin
- Mot de passe (min 6 caractères)
- Prénom
- Nom
- Téléphone

## Méthode 2 : Via le Dashboard Supabase

1. Allez sur https://app.supabase.com/project/qjfygjtondljywhbqbfj/auth/users
2. Cliquez sur **"Add User"** ou **"Ajouter un utilisateur"**
3. Remplissez les informations
4. Dans la table `profiles`, mettez `role = 'admin'` pour cet utilisateur

## Méthode 3 : Via SQL dans Supabase

1. Allez sur https://app.supabase.com/project/qjfygjtondljywhbqbfj/sql/new
2. Exécutez ce SQL (remplacez les valeurs) :

```sql
-- Créer l'utilisateur (remplacez les valeurs)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@empire-events.com',  -- Votre email admin
    crypt('VotreMotDePasse123', gen_salt('bf')),  -- Votre mot de passe
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Admin","last_name":"User"}',
    false,
    '',
    '',
    '',
    ''
) RETURNING id;

-- Notez l'ID retourné, puis créez le profil :

INSERT INTO profiles (
    id,
    role,
    first_name,
    last_name,
    phone
) VALUES (
    'ID_RETOURNE_CI_DESSUS',  -- Remplacez par l'ID de l'utilisateur créé
    'admin',
    'Admin',
    'User',
    '+224612345678'
);
```

## Obtenir un token JWT pour les tests

Une fois l'utilisateur créé, utilisez la fonction `auth-login` pour obtenir un token :

```http
POST https://qjfygjtondljywhbqbfj.supabase.co/functions/v1/auth-login
Content-Type: application/json

{
  "email": "admin@empire-events.com",
  "password": "VotreMotDePasse123"
}
```

La réponse contiendra un `session.access_token` que vous pouvez utiliser dans vos tests.

## Utiliser le token dans les fichiers test.http

Remplacez `YOUR_JWT_TOKEN_HERE` par le token obtenu :

```http
@authToken = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

