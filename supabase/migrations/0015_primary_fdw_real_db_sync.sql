-- =============================================================================
-- Migration 0015: Connect REAL Secondary Supabase DB (jhihqmkqvbwfniwculhk) via FDW
-- Maps hostiggo_testing_schema.users into prod_db.users and exposes public views
-- Run this script in the SQL Editor of your PRIMARY Supabase (Hostiggo Admin Portal DB)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 1. Clean up old foreign server & schema definitions to prevent relation collision
DROP SERVER IF EXISTS secondary_production_db CASCADE;
DROP SCHEMA IF EXISTS prod_db CASCADE;

-- 2. Create Foreign Server for Real Secondary Project jhihqmkqvbwfniwculhk
CREATE SERVER secondary_production_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.jhihqmkqvbwfniwculhk.supabase.co',
    port '5432',
    dbname 'postgres',
    sslmode 'require'
  );

CREATE USER MAPPING FOR postgres
  SERVER secondary_production_db
  OPTIONS (
    user 'postgres',
    password 'C4VKKwLU7zUCTp2t'
  );

CREATE SCHEMA prod_db;

-- 3. Import Foreign Tables without collisions:
-- Import users from hostiggo_testing_schema
IMPORT FOREIGN SCHEMA hostiggo_testing_schema
  LIMIT TO (users)
  FROM SERVER secondary_production_db
  INTO prod_db;

-- Import support tables from public schema
IMPORT FOREIGN SCHEMA public
  LIMIT TO (complaint_categories, support_tickets, chat_messages)
  FROM SERVER secondary_production_db
  INTO prod_db;

-- 4. Create Views in public schema of Primary DB mapping user_id -> id and name -> display_name
CREATE OR REPLACE VIEW public.fdw_users AS
SELECT 
  user_id AS id,
  user_id,
  name AS display_name,
  name,
  email,
  phone,
  created_at,
  updated_at
FROM prod_db.users;

CREATE OR REPLACE VIEW public.fdw_support_tickets AS
SELECT * FROM prod_db.support_tickets;

CREATE OR REPLACE VIEW public.fdw_chat_messages AS
SELECT * FROM prod_db.chat_messages;

CREATE OR REPLACE VIEW public.fdw_complaint_categories AS
SELECT * FROM prod_db.complaint_categories;

-- 5. Grant SELECT on views to API roles
GRANT SELECT ON public.fdw_users TO anon, authenticated, service_role, postgres;
GRANT SELECT ON public.fdw_support_tickets TO anon, authenticated, service_role, postgres;
GRANT SELECT ON public.fdw_chat_messages TO anon, authenticated, service_role, postgres;
GRANT SELECT ON public.fdw_complaint_categories TO anon, authenticated, service_role, postgres;

-- 6. Reload PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
