-- Run on the APP project (jhihqmkqvbwfniwculhk): lets agents be recorded against app tickets.
-- Additive and nullable; the admin portal works without it (it falls back to status-only updates).
alter table public.support_tickets
  add column if not exists assigned_agent_id uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists queued_at timestamptz default now();
update public.support_tickets set queued_at = created_at where queued_at is null;
