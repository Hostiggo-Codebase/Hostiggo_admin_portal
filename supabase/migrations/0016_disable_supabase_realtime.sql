-- =============================================================================
-- Migration 0016: DISABLE SUPABASE REALTIME (Switched to Socket.io WebSocket Server)
-- Run this script in the SQL Editor of your Supabase Projects to turn off Realtime
-- =============================================================================

-- Remove tables from supabase_realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.support_tickets;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.chat_messages;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.complaint_categories;
