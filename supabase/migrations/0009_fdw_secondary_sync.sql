-- =============================================================================
-- Migration 0009: Connect Secondary Supabase (Production DB) via FDW
-- Run this in the SQL Editor of your PRIMARY Supabase (Hostiggo Admin Portal DB)
-- =============================================================================

-- 1. Enable Foreign Data Wrapper Extension
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 2. Create Foreign Server pointing to Secondary Supabase Host
CREATE SERVER IF NOT EXISTS secondary_production_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.vbqwitfzrglqojiijtmu.supabase.co',
    port '5432',
    dbname 'postgres',
    sslmode 'require'
  );

-- 3. Map local postgres user to Secondary Supabase credentials
-- REPLACE 'YOUR_SECONDARY_DB_PASSWORD' with the database password of project vbqwitfzrglqojiijtmu
CREATE USER MAPPING IF NOT EXISTS FOR postgres
  SERVER secondary_production_db
  OPTIONS (
    user 'postgres',
    password 'YOUR_SECONDARY_DB_PASSWORD'
  );

-- 4. Create local schema `prod_db`
CREATE SCHEMA IF NOT EXISTS prod_db;

-- 5. Import foreign tables from Secondary Supabase into `prod_db`
IMPORT FOREIGN SCHEMA public
  LIMIT TO (users, bookings, complaint_categories, support_tickets, chat_messages)
  FROM SERVER secondary_production_db
  INTO prod_db;
