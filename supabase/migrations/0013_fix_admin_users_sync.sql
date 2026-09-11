-- =============================================================================
-- Migration 0013: Fix assigned_agent_id FK
--
-- Problem: support_tickets.assigned_agent_id references admin_users(admin_id).
-- The take_ticket RPC sets assigned_agent_id = auth.uid(), so the calling user
-- must already have a row in admin_users.  After supabase db reset the seed
-- script re-creates auth.users entries but auth.users is NOT reset by db reset,
-- so if the explicit admin_users upsert in the seed script fails or hasn't run
-- yet, take_ticket throws a FK violation.
--
-- Fix: re-point the FK to auth.users(id) instead.  Any authenticated caller
-- of take_ticket is already in auth.users by definition, so the FK can never
-- be violated.  Role-checking is done inside the RPC itself (PERMISSION_DENIED
-- if not agent/super_admin), so there is no security regression.
-- =============================================================================

-- Drop the old trigger created in an earlier draft of this migration
-- (it caused GoTrue "Database error creating new user" on agent creation).
drop trigger if exists trg_sync_auth_to_admin on auth.users;
drop function if exists sync_auth_role_to_admin();

-- Re-point assigned_agent_id → auth.users
alter table support_tickets
  drop constraint if exists support_tickets_assigned_agent_id_fkey;

alter table support_tickets
  add constraint support_tickets_assigned_agent_id_fkey
  foreign key (assigned_agent_id) references auth.users (id) on delete set null;

-- Re-point transferred_from → auth.users (same issue, same fix)
alter table support_tickets
  drop constraint if exists support_tickets_transferred_from_fkey;

alter table support_tickets
  add constraint support_tickets_transferred_from_fkey
  foreign key (transferred_from) references auth.users (id) on delete set null;
