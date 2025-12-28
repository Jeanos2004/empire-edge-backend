-- ============================================================================
-- EMPIRE EVENTS - SCHÉMA BASE DE DONNÉES SUPABASE
-- Version 1.0 - Décembre 2025
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS SUPABASE
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUMS (Types personnalisés)
-- ============================================================================

-- Types d'événements
CREATE TYPE event_type AS ENUM (
  'mariage_traditionnel',
  'mariage_religieux',
  'mariage_moderne',
  'mariage_plein_air',
  'fiancailles',
  'dot',
  'anniversaire_adulte',
  'anniversaire_enfant',
  'anniversaire_vip',
  'bapteme',
  'nomination',
  'funerailles',
  'ceremonie_commemorative',
  'reception_privee',
  'garden_party',
  'baby_shower',
  'gender_reveal',
  'diner_gala_prive',
  'seminaire',
  'team_building',
  'retraite_entreprise',
  'conference',
  'panel',
  'workshop',
  'masterclass',
  'assemblee_generale',
  'inauguration',
  'lancement_produit',
  'soiree_entreprise',
  'afterwork',
  'gala_entreprise',
  'fete_fin_annee',
  'foire_commerciale',
  'exposition',
  'journee_portes_ouvertes',
  'ceremonie_officielle',
  'sommet',
  'visite_presidentielle',
  'investiture',
  'rencontre_diplomatique',
  'reception_officielle',
  'colloque',
  'forum',
  'remise_diplomes',
  'ceremonie_universitaire',
  'conference_scientifique',
  'campagne_sensibilisation',
  'collecte_fonds',
  'gala_caritatif',
  'evenement_humanitaire',
  'concert',
  'showcase',
  'festival_culturel',
  'exposition_art',
  'vernissage',
  'defile_mode',
  'spectacle_danse',
  'spectacle_theatre',
  'slam',
  'lecture_publique',
  'concours_poesie',
  'tournoi_sportif',
  'marathon',
  'course_populaire',
  'evenement_fitness',
  'evenement_wellness',
  'competition_esport',
  'activite_plein_air',
  'evenement_masse',
  'carnaval',
  'parade',
  'celebration_nationale',
  'fete_religieuse',
  'marche_public',
  'salon_public',
  'evenement_hybride',
  'silent_party',
  'evenement_instagrammable',
  'evenement_ecoresponsable',
  'gaming_night',
  'soiree_geek',
  'popup_store',
  'evenement_ephemere'
);

-- Catégories d'événements
CREATE TYPE event_category AS ENUM (
  'prive_familial',
  'corporate_professionnel',
  'institutionnel_associatif',
  'culturel_artistique',
  'sportif_loisirs',
  'public_populaire',
  'innovant_moderne'
);

-- Types de services
CREATE TYPE service_type AS ENUM (
  'reservation_lieu',
  'traiteur_boissons',
  'decoration_design',
  'animations_artistes',
  'photo_video',
  'gestion_invites',
  'location_materiel',
  'communication_marketing',
  'streaming_hybride'
);

-- Statuts de devis
CREATE TYPE quote_status AS ENUM (
  'brouillon',
  'en_attente',
  'en_cours_revision',
  'envoye',
  'accepte',
  'refuse',
  'expire'
);

-- Statuts d'événement
CREATE TYPE event_status AS ENUM (
  'planification',
  'confirme',
  'en_preparation',
  'en_cours',
  'termine',
  'annule'
);

-- Statuts de paiement
CREATE TYPE payment_status AS ENUM (
  'en_attente',
  'acompte_recu',
  'partiellement_paye',
  'paye',
  'rembourse',
  'annule'
);

-- Types de paiement
CREATE TYPE payment_type AS ENUM (
  'acompte',
  'echeance',
  'solde',
  'remboursement'
);

-- Styles d'événement
CREATE TYPE event_style AS ENUM (
  'classique',
  'moderne',
  'vip',
  'ecoresponsable',
  'traditionnel',
  'contemporain',
  'luxe',
  'minimaliste'
);

-- Rôles utilisateurs
CREATE TYPE user_role AS ENUM (
  'client',
  'admin',
  'super_admin',
  'prestataire'
);

-- ============================================================================
-- 3. TABLES PRINCIPALES
-- ============================================================================

-- Table Users (liée à auth.users de Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'client' NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  company_name VARCHAR(200),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Clients (extension de profiles pour clients)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Guinée',
  preferences JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- Table Prestataires (partenaires)
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  service_type service_type NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  description TEXT,
  rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
  total_reviews INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  specialties TEXT[],
  price_range_min DECIMAL(15,2),
  price_range_max DECIMAL(15,2),
  portfolio_images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Lieux
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  capacity_min INTEGER,
  capacity_max INTEGER NOT NULL,
  is_indoor BOOLEAN DEFAULT true,
  is_unusual BOOLEAN DEFAULT false,
  venue_type VARCHAR(100),
  amenities TEXT[],
  price_per_day DECIMAL(15,2),
  images TEXT[],
  is_available BOOLEAN DEFAULT true,
  calendar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Disponibilités des Lieux
CREATE TABLE venue_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(venue_id, date)
);

-- Table Événements
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  event_type event_type NOT NULL,
  event_category event_category NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue_id UUID REFERENCES venues(id),
  guest_count INTEGER NOT NULL,
  status event_status DEFAULT 'planification' NOT NULL,
  style event_style,
  budget_min DECIMAL(15,2),
  budget_max DECIMAL(15,2),
  special_requirements TEXT,
  is_hybrid BOOLEAN DEFAULT false,
  is_eco_friendly BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Services (catalogue de services)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type service_type NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  base_price DECIMAL(15,2),
  unit VARCHAR(50),
  is_customizable BOOLEAN DEFAULT true,
  configuration_schema JSONB,
  images TEXT[],
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Services Personnalisés par Événement
CREATE TABLE event_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) NOT NULL,
  provider_id UUID REFERENCES providers(id),
  configuration JSONB DEFAULT '{}',
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Devis
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  status quote_status DEFAULT 'brouillon' NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  validity_date DATE,
  notes TEXT,
  terms_conditions TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Lignes de Devis
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  event_service_id UUID REFERENCES event_services(id),
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Contrats
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_client TEXT,
  signature_empire TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Paiements
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  payment_type payment_type NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status payment_status DEFAULT 'en_attente' NOT NULL,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(100),
  transaction_id VARCHAR(200),
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Invités
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  category VARCHAR(100),
  rsvp_status VARCHAR(50),
  rsvp_date TIMESTAMP WITH TIME ZONE,
  dietary_restrictions TEXT[],
  plus_one BOOLEAN DEFAULT false,
  notes TEXT,
  badge_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  invitation_type VARCHAR(50) DEFAULT 'digital',
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  token VARCHAR(200) UNIQUE,
  custom_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Messages (messagerie client-admin)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subject VARCHAR(300),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  parent_message_id UUID REFERENCES messages(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  title VARCHAR(300) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Articles Blog
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  category VARCHAR(100),
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Témoignages
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT NOT NULL,
  client_name VARCHAR(200),
  client_photo TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Paramètres Système
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES pour optimisation des performances
-- ============================================================================

CREATE INDEX idx_events_client_id ON events(client_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_type ON events(event_type);

CREATE INDEX idx_quotes_event_id ON quotes(event_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_number ON quotes(quote_number);

CREATE INDEX idx_payments_event_id ON payments(event_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_guests_event_id ON guests(event_id);
CREATE INDEX idx_guests_email ON guests(email);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_event ON messages(event_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

CREATE INDEX idx_event_services_event ON event_services(event_id);
CREATE INDEX idx_event_services_service ON event_services(service_id);

CREATE INDEX idx_providers_type ON providers(service_type);
CREATE INDEX idx_providers_active ON providers(is_active);

CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_capacity ON venues(capacity_max);

CREATE INDEX idx_venue_availability_date ON venue_availability(venue_id, date);

-- ============================================================================
-- 5. TRIGGERS pour updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_services_updated_at BEFORE UPDATE ON event_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) - Politiques de sécurité
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Politiques pour profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour events
CREATE POLICY "Clients can view own events" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients WHERE id = events.client_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour quotes
CREATE POLICY "Clients can view own quotes" ON quotes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN clients c ON c.id = e.client_id
      WHERE e.id = quotes.event_id AND c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage quotes" ON quotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour messages
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Politiques pour notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Politiques pour blog (public en lecture)
CREATE POLICY "Anyone can view published posts" ON blog_posts
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage posts" ON blog_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour services (public en lecture)
CREATE POLICY "Anyone can view active services" ON services
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage services" ON services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Politiques pour venues (public en lecture)
CREATE POLICY "Anyone can view available venues" ON venues
  FOR SELECT USING (is_available = true);

CREATE POLICY "Admins can manage venues" ON venues
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 7. FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour générer un numéro de devis
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_number VARCHAR(50);
  year_code VARCHAR(4);
  sequence_num INTEGER;
BEGIN
  year_code := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM quotes
  WHERE quote_number LIKE 'DEV-' || year_code || '%';
  
  new_number := 'DEV-' || year_code || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer un numéro de contrat
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_number VARCHAR(50);
  year_code VARCHAR(4);
  sequence_num INTEGER;
BEGIN
  year_code := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM contracts
  WHERE contract_number LIKE 'CTR-' || year_code || '%';
  
  new_number := 'CTR-' || year_code || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le total d'un devis
CREATE OR REPLACE FUNCTION calculate_quote_total(quote_id_param UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  total DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO total
  FROM quote_items
  WHERE quote_id = quote_id_param;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier la disponibilité d'un lieu
CREATE OR REPLACE FUNCTION check_venue_availability(
  venue_id_param UUID,
  date_param DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  is_available BOOLEAN;
BEGIN
  SELECT COALESCE(va.is_available, true)
  INTO is_available
  FROM venue_availability va
  WHERE va.venue_id = venue_id_param AND va.date = date_param;
  
  RETURN is_available;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VUES UTILES
-- ============================================================================

-- Vue pour le dashboard admin
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  COUNT(DISTINCT e.id) as total_events,
  COUNT(DISTINCT CASE WHEN e.event_date >= CURRENT_DATE THEN e.id END) as upcoming_events,
  COUNT(DISTINCT CASE WHEN e.status = 'termine' THEN e.id END) as completed_events,
  COUNT(DISTINCT q.id) as total_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'en_attente' THEN q.id END) as pending_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'accepte' THEN q.id END) as accepted_quotes,
  COALESCE(SUM(CASE WHEN p.status = 'paye' THEN p.amount END), 0) as total_revenue,
  COUNT(DISTINCT c.id) as total_clients
FROM events e
LEFT JOIN quotes q ON q.event_id = e.id
LEFT JOIN payments p ON p.event_id = e.id
LEFT JOIN clients c ON c.id = e.client_id;

-- Vue pour les événements à venir avec détails
CREATE OR REPLACE VIEW upcoming_events_detailed AS
SELECT
  e.id,
  e.title,
  e.event_type,
  e.event_category,
  e.event_date,
  e.start_time,
  e.guest_count,
  e.status,
  v.name as venue_name,
  v.address as venue_address,
  p.first_name || ' ' || p.last_name as client_name,
  p.phone as client_phone,
  q.total_amount as quote_amount,
  q.status as quote_status
FROM events e
LEFT JOIN venues v ON v.id = e.venue_id
LEFT JOIN clients c ON c.id = e.client_id
LEFT JOIN profiles p ON p.id = c.profile_id
LEFT JOIN quotes q ON q.event_id = e.id
WHERE e.event_date >= CURRENT_DATE
ORDER BY e.event_date ASC;

-- ============================================================================
-- 9. DONNÉES INITIALES (SEED DATA)
-- ============================================================================

-- Insérer les paramètres système par défaut
INSERT INTO settings (key, value, description) VALUES
('tax_rate', '0.18', 'Taux de TVA par défaut (18%)'),
('default_quote_validity_days', '30', 'Validité par défaut d''un devis en jours'),
('deposit_percentage', '30', 'Pourcentage d''acompte par défaut'),
('company_info', '{"name": "Empire Events", "address": "Conakry, Guinée", "phone": "+224...", "email": "contact@empireevents.gn"}', 'Informations de l''entreprise');

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================