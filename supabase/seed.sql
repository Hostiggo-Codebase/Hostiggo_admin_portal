-- =============================================================================
-- Seed: complaint_categories, SLA targets (already inserted in migrations),
-- demo admin users (requires auth.users rows to exist first — run via CLI).
-- =============================================================================

-- Complaint categories
insert into complaint_categories (name, description) values
  ('Payment',  'Issues related to payments, charges, or billing'),
  ('Booking',  'Booking-related questions or problems'),
  ('Property', 'Property condition or host conduct complaints'),
  ('Refund',   'Refund requests and disputes'),
  ('Other',    'General or uncategorized support requests')
on conflict do nothing;

-- Demo agent (replace UUIDs with real auth.users IDs after seeding auth)
-- Usage: after running `supabase db reset`, create auth users via Supabase dashboard
-- or the admin API, then paste their UUIDs here and re-run this seed block.

-- insert into admin_users (admin_id, display_name, role) values
--   ('00000000-0000-0000-0000-000000000001', 'Alice (Agent)',      'ADMIN'),
--   ('00000000-0000-0000-0000-000000000002', 'Bob (Super Admin)',  'SUPER_ADMIN');
