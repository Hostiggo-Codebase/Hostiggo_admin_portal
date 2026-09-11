-- =============================================================================
-- SECONDARY SUPABASE PROJECT SCHEMA (Production DB for Dummy App)
-- Run this script in the SQL Editor of your Secondary Supabase Project
-- =============================================================================

-- 1. Create Complaint Categories
CREATE TABLE IF NOT EXISTS public.complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed Categories matching dummy IDs
INSERT INTO public.complaint_categories (id, name, description) VALUES
  ('ca111111-1111-1111-1111-111111111111', 'Payment', 'Payment failures, double charges'),
  ('ca222222-2222-2222-2222-222222222222', 'Booking Help', 'Booking modifications, cancellations'),
  ('ca333333-3333-3333-3333-333333333333', 'Property Issue', 'Cleanliness, AC/heating, key access'),
  ('ca444444-4444-4444-4444-444444444444', 'Refund Request', 'Security deposit refunds')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Users Table (Production)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

-- Seed Demo Users
INSERT INTO public.users (id, email, display_name, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'rahul.sharma@example.com', 'Rahul Sharma', '+91 98765 43210'),
  ('22222222-2222-2222-2222-222222222222', 'priya.patel@example.com', 'Priya Patel', '+91 91234 56789'),
  ('33333333-3333-3333-3333-333333333333', 'vikram.m@example.com', 'Vikram Malhotra', '+91 99887 76655')
ON CONFLICT (id) DO NOTHING;

-- 3. Create Bookings Table (Production)
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  booking_code text NOT NULL UNIQUE,
  property_title text NOT NULL,
  status text DEFAULT 'CONFIRMED',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

-- Seed Demo Bookings
INSERT INTO public.bookings (id, user_id, booking_code, property_title) VALUES
  ('ba111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'HG-BK-8821', 'Luxury Villa Goa'),
  ('ba222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'HG-BK-9043', 'Mountain Chalet Manali')
ON CONFLICT (id) DO NOTHING;

-- 4. Create Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE DEFAULT ('HG' || floor(random() * 90000 + 10000)::text),
  user_id uuid REFERENCES public.users(id),
  category_id uuid REFERENCES public.complaint_categories(id),
  booking_id uuid REFERENCES public.bookings(id),
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

-- 5. Create Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(ticket_id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  body text NOT NULL,
  is_internal_note boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime on support_tickets and chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Enable RLS Policies (Allow all for testing demo app)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
