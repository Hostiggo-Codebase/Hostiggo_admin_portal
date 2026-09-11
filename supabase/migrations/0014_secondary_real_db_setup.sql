-- =============================================================================
-- Migration 0014: REAL SECONDARY SUPABASE DATABASE SETUP (jhihqmkqvbwfniwculhk)
-- Schema provided by Real Production Database (hostiggo_testing_schema.users)
-- Run this script in the SQL Editor of your REAL Supabase Project (jhihqmkqvbwfniwculhk)
-- =============================================================================

-- 1. Ensure Custom Schema hostiggo_testing_schema & users Table exist
CREATE SCHEMA IF NOT EXISTS hostiggo_testing_schema;

CREATE TABLE IF NOT EXISTS hostiggo_testing_schema.users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  age int4,
  is_active bool DEFAULT true,
  profile_pic_url text,
  is_verified bool DEFAULT false,
  emergency_contact varchar,
  email_notifications bool DEFAULT true,
  sms_alerts bool DEFAULT true,
  promo_notifications bool DEFAULT true,
  host_message_notifications bool DEFAULT true,
  show_profile_to_hosts bool DEFAULT true,
  include_in_search bool DEFAULT true,
  activity_status bool DEFAULT true
);

-- Expose unified public view for users table (maps user_id -> id and name -> display_name)
CREATE OR REPLACE VIEW public.users AS
SELECT 
  user_id AS id,
  user_id,
  name AS display_name,
  name,
  email,
  phone,
  profile_pic_url,
  age,
  is_active,
  is_verified,
  emergency_contact,
  created_at,
  updated_at
FROM hostiggo_testing_schema.users;

-- 2. Create Complaint Categories Table
CREATE TABLE IF NOT EXISTS public.complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.complaint_categories (id, name, description) VALUES
  ('ca111111-1111-1111-1111-111111111111', 'Payment', 'Payment failures, double charges'),
  ('ca222222-2222-2222-2222-222222222222', 'Booking Help', 'Booking modifications, cancellations'),
  ('ca333333-3333-3333-3333-333333333333', 'Property Issue', 'Cleanliness, AC/heating, key access'),
  ('ca444444-4444-4444-4444-444444444444', 'Refund Request', 'Security deposit refunds')
ON CONFLICT (id) DO NOTHING;

-- 3. Create Support Tickets Table (references hostiggo_testing_schema.users.user_id)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE DEFAULT ('HG' || floor(random() * 90000 + 10000)::text),
  user_id uuid REFERENCES hostiggo_testing_schema.users(user_id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.complaint_categories(id),
  booking_id uuid,
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'QUEUED',
  priority_label text DEFAULT 'General',
  priority int DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rating int,
  rating_comment text
);

-- 4. Create Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(ticket_id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  body text NOT NULL,
  is_internal_note boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Grant Permissions & Realtime
GRANT ALL ON SCHEMA hostiggo_testing_schema TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA hostiggo_testing_schema TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.users TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.support_tickets TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.chat_messages TO anon, authenticated, service_role, postgres;
GRANT ALL ON public.complaint_categories TO anon, authenticated, service_role, postgres;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE hostiggo_testing_schema.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write users" ON hostiggo_testing_schema.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
