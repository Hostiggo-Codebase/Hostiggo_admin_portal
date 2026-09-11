-- =============================================================================
-- Migration 0011: Expose FDW Foreign Tables as Views in `public` Schema
-- Run this in Primary Supabase SQL Editor
-- =============================================================================

-- 1. Create View for Tickets in public schema
CREATE OR REPLACE VIEW public.fdw_support_tickets AS
SELECT * FROM prod_db.support_tickets;

-- 2. Create View for Chat Messages in public schema
CREATE OR REPLACE VIEW public.fdw_chat_messages AS
SELECT * FROM prod_db.chat_messages;

-- 3. Create View for Complaint Categories in public schema
CREATE OR REPLACE VIEW public.fdw_complaint_categories AS
SELECT * FROM prod_db.complaint_categories;

-- 4. Grant SELECT on views to API roles
GRANT SELECT ON public.fdw_support_tickets TO anon, authenticated, service_role, postgres;
GRANT SELECT ON public.fdw_chat_messages TO anon, authenticated, service_role, postgres;
GRANT SELECT ON public.fdw_complaint_categories TO anon, authenticated, service_role, postgres;

-- 5. Reload PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
