-- ============================================
-- SCRIPT SQL POUR CRÉER LES DONNÉES DE TEST
-- À exécuter dans le SQL Editor de Supabase
-- Basé sur le schéma SQL fourni
-- ============================================

-- ============================================
-- 1. CRÉER DES LIEUX (VENUES)
-- ============================================

INSERT INTO venues (name, address, city, capacity_max, capacity_min, price_per_day, description, amenities, is_available, is_indoor, venue_type) VALUES
('Salle des Fêtes Conakry', '123 Avenue de la République', 'Conakry', 300, 50, 5000000, 'Grande salle pour événements avec parking et climatisation', ARRAY['parking', 'climatisation', 'sonorisation', 'wifi'], true, true, 'salle_reception'),
('Hôtel Palm Beach', '456 Boulevard du Commerce', 'Conakry', 200, 30, 8000000, 'Hôtel de luxe avec salle de réception élégante', ARRAY['parking', 'climatisation', 'wifi', 'restaurant', 'bar'], true, true, 'hotel'),
('Centre de Conférences Alpha', '789 Rue de la Paix', 'Conakry', 500, 100, 10000000, 'Centre moderne pour conférences et séminaires', ARRAY['parking', 'climatisation', 'wifi', 'projecteur', 'sonorisation', 'traduction'], true, true, 'centre_conference'),
('Jardin Événementiel', '321 Avenue de la Liberté', 'Kindia', 150, 20, 3000000, 'Jardin pour événements en plein air avec éclairage', ARRAY['parking', 'éclairage', 'toilettes', 'cuisine'], true, false, 'jardin'),
('Salle Polyvalente', '654 Rue du Marché', 'Conakry', 100, 15, 2000000, 'Petite salle pour événements intimes', ARRAY['climatisation', 'wifi', 'sonorisation'], true, true, 'salle_polyvalente'),
('Terrasse Panoramique', '987 Boulevard de la Mer', 'Conakry', 80, 10, 4000000, 'Terrasse avec vue sur la mer pour événements privés', ARRAY['parking', 'bar', 'cuisine', 'éclairage'], true, false, 'terrasse');

-- ============================================
-- 2. CRÉER DES SERVICES
-- ============================================

INSERT INTO services (name, service_type, description, base_price, is_active, unit) VALUES
('Traiteur Premium', 'traiteur_boissons', 'Service de restauration haut de gamme avec menu personnalisé', 50000, true, 'personne'),
('Traiteur Standard', 'traiteur_boissons', 'Service de restauration standard pour événements', 30000, true, 'personne'),
('Photographe Professionnel', 'photo_video', 'Photographie et vidéo pour événements - Package complet', 300000, true, 'journee'),
('Photographe Basique', 'photo_video', 'Photographie simple pour événements', 150000, true, 'journee'),
('DJ et Sonorisation', 'animations_artistes', 'Animation musicale et équipement son professionnel', 200000, true, 'journee'),
('Groupe Musical Live', 'animations_artistes', 'Groupe de musique live pour événements', 500000, true, 'journee'),
('Décoration Florale', 'decoration_design', 'Arrangements floraux et décoration sur mesure', 150000, true, 'forfait'),
('Décoration Complète', 'decoration_design', 'Service de décoration complet pour événements', 300000, true, 'forfait'),
('Service de Sécurité', 'gestion_invites', 'Agents de sécurité pour événements', 100000, true, 'agent'),
('Transport VIP', 'location_materiel', 'Service de transport pour invités VIP', 250000, true, 'vehicule'),
('Animation Enfants', 'animations_artistes', 'Activités et garde pour enfants pendant l''événement', 80000, true, 'journee'),
('Éclairage Professionnel', 'decoration_design', 'Installation et gestion éclairage professionnel', 120000, true, 'forfait'),
('Location Mobilier', 'location_materiel', 'Location de mobilier et équipements', 100000, true, 'lot'),
('Service Traduction', 'communication_marketing', 'Service de traduction simultanée', 200000, true, 'journee');

-- ============================================
-- 3. CRÉER DES PROVIDERS
-- ============================================

INSERT INTO providers (name, email, phone, service_type, address, description, rating, total_reviews, is_active) VALUES
('Traiteur Deluxe', 'contact@traiteur-deluxe.com', '+224612345700', 'traiteur_boissons', '100 Rue Gaston, Conakry', 'Traiteur premium spécialisé dans les événements haut de gamme', 4.8, 45, true),
('Cuisine du Chef', 'info@cuisine-chef.com', '+224612345701', 'traiteur_boissons', '200 Avenue Alpha, Conakry', 'Cuisine raffinée pour tous types d''événements', 4.6, 32, true),
('Studio Photo Pro', 'info@studiophoto.com', '+224612345702', 'photo_video', '300 Boulevard Beta, Conakry', 'Photographie et vidéo professionnelles', 4.9, 67, true),
('Photo Express', 'contact@photoexpress.com', '+224612345703', 'photo_video', '400 Rue Gamma, Conakry', 'Service photo rapide et efficace', 4.5, 28, true),
('DJ Sound System', 'dj@soundsystem.com', '+224612345704', 'animations_artistes', '500 Avenue Delta, Conakry', 'Animation musicale et sonorisation professionnelle', 4.7, 52, true),
('Music Live Band', 'contact@musiclive.com', '+224612345705', 'animations_artistes', '600 Boulevard Epsilon, Conakry', 'Groupes de musique live pour événements', 4.8, 38, true),
('Fleurs & Décoration', 'contact@fleurs-deco.com', '+224612345706', 'decoration_design', '700 Rue Zeta, Conakry', 'Décoration florale et design d''intérieur', 4.6, 41, true),
('Déco Élégance', 'info@deco-elegance.com', '+224612345707', 'decoration_design', '800 Avenue Eta, Conakry', 'Décoration sur mesure pour événements élégants', 4.7, 35, true),
('Sécurité Plus', 'securite@plus.com', '+224612345708', 'gestion_invites', '900 Boulevard Theta, Conakry', 'Service de sécurité professionnel', 4.5, 29, true),
('Transport VIP Service', 'contact@transportvip.com', '+224612345709', 'location_materiel', '1000 Rue Iota, Conakry', 'Transport de luxe pour invités VIP', 4.8, 43, true),
('Kids Animation', 'contact@kidsanimation.com', '+224612345710', 'animations_artistes', '1100 Avenue Kappa, Conakry', 'Animation et garde d''enfants pour événements', 4.6, 26, true),
('Light Pro', 'info@lightpro.com', '+224612345711', 'decoration_design', '1200 Boulevard Lambda, Conakry', 'Éclairage professionnel et design lumière', 4.7, 33, true);

-- ============================================
-- 4. CRÉER DES DISPONIBILITÉS DE LIEUX
-- ============================================

-- Disponibilité pour Salle des Fêtes Conakry
INSERT INTO venue_availability (venue_id, date, is_available, reason) VALUES
((SELECT id FROM venues WHERE name = 'Salle des Fêtes Conakry' LIMIT 1), '2025-06-15', true, NULL),
((SELECT id FROM venues WHERE name = 'Salle des Fêtes Conakry' LIMIT 1), '2025-06-20', true, NULL),
((SELECT id FROM venues WHERE name = 'Salle des Fêtes Conakry' LIMIT 1), '2025-07-10', true, NULL);

-- Disponibilité pour Hôtel Palm Beach
INSERT INTO venue_availability (venue_id, date, is_available, reason) VALUES
((SELECT id FROM venues WHERE name = 'Hôtel Palm Beach' LIMIT 1), '2025-05-20', true, NULL),
((SELECT id FROM venues WHERE name = 'Hôtel Palm Beach' LIMIT 1), '2025-06-15', false, 'Réservé pour un autre événement'),
((SELECT id FROM venues WHERE name = 'Hôtel Palm Beach' LIMIT 1), '2025-08-25', true, NULL);

-- Disponibilité pour Centre de Conférences Alpha
INSERT INTO venue_availability (venue_id, date, is_available, reason) VALUES
((SELECT id FROM venues WHERE name = 'Centre de Conférences Alpha' LIMIT 1), '2025-05-20', true, NULL),
((SELECT id FROM venues WHERE name = 'Centre de Conférences Alpha' LIMIT 1), '2025-08-25', true, NULL);

-- ============================================
-- 5. CRÉER DES ARTICLES DE BLOG (OPTIONNEL)
-- ============================================

-- Note: Les articles de blog nécessitent un author_id valide (un profil admin)
-- Si aucun admin n'existe encore, ces INSERT échoueront. Créez d'abord un admin.

INSERT INTO blog_posts (title, slug, content, excerpt, author_id, published_at, is_published, category, tags) VALUES
('10 Conseils pour Organiser un Mariage Réussi', '10-conseils-mariage-reussi', 'Contenu complet de l''article sur l''organisation de mariages. Découvrez les meilleures pratiques pour créer un événement inoubliable...', 'Découvrez nos meilleurs conseils pour organiser un mariage inoubliable.', (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1), NOW(), true, 'conseils', ARRAY['mariage', 'organisation', 'conseils']),
('Comment Choisir le Bon Lieu pour Votre Événement', 'choisir-lieu-evenement', 'Contenu complet de l''article sur le choix de lieux. Guide détaillé pour sélectionner le lieu parfait...', 'Guide complet pour choisir le lieu parfait pour votre événement.', (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1), NOW(), true, 'guide', ARRAY['lieu', 'venue', 'choix']),
('Les Tendances Événementielles 2025', 'tendances-evenementielles-2025', 'Contenu complet sur les tendances événementielles. Découvrez les innovations et tendances qui marqueront 2025...', 'Découvrez les dernières tendances dans l''organisation d''événements.', (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1), NOW(), true, 'tendances', ARRAY['tendances', '2025', 'innovation']);

-- ============================================
-- 6. CRÉER DES TÉMOIGNAGES (OPTIONNEL)
-- ============================================

-- Note: Les témoignages peuvent être liés à un client_id et/ou event_id
-- Si vous voulez les lier à des clients existants, utilisez:
-- client_id: (SELECT id FROM clients WHERE profile_id = (SELECT id FROM profiles WHERE email = 'jean.dupont@example.com' LIMIT 1) LIMIT 1)

INSERT INTO testimonials (client_name, rating, comment, is_approved, is_featured) VALUES
('Jean Dupont', 5, 'Service exceptionnel! Notre mariage était parfait grâce à l''équipe Empire Events.', true, true),
('Marie Martin', 4, 'Très professionnel et organisé. Je recommande vivement.', true, false),
('Amadou Diallo', 5, 'Excellent service de A à Z. Tout s''est déroulé à la perfection.', true, true);

-- ============================================
-- NOTES
-- ============================================
-- 
-- 1. Les IDs des venues, services et providers seront générés automatiquement
-- 2. Vous pouvez ajuster les dates selon vos besoins
-- 3. Les prix sont en GNF (Francs Guinéens)
-- 4. Pour les blog_posts et testimonials, vous devrez peut-être ajuster les IDs
--    selon vos données réelles
-- 5. Les types de services utilisent les valeurs enum du schéma:
--    - traiteur_boissons, photo_video, animations_artistes, decoration_design,
--      gestion_invites, location_materiel, communication_marketing, streaming_hybride
-- 6. Les venues utilisent price_per_day (pas price_per_hour)
-- 7. Les providers utilisent is_active (pas is_available) et address (pas city séparé)
-- 8. venue_availability utilise reason (pas price_modifier)
-- 
-- ============================================
