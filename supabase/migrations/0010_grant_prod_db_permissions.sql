-- =============================================================================
-- Migration 0010: Grant Schema & Table Permissions for FDW prod_db
-- Run this in Primary Supabase SQL Editor
-- =============================================================================

-- 1. Grant usage on schema prod_db to API roles
GRANT USAGE ON SCHEMA prod_db TO anon, authenticated, service_role, postgres;

-- 2. Grant SELECT/INSERT/UPDATE permissions on all foreign tables in prod_db
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA prod_db TO anon, authenticated, service_role, postgres;

-- 3. Ensure future tables in prod_db are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA prod_db GRANT SELECT, INSERT, UPDATE ON TABLES TO anon, authenticated, service_role, postgres;

-- 4. Reload PostgREST API Schema Cache
NOTIFY pgrst, 'reload schema';
