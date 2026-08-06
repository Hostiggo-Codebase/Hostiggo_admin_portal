-- =============================================================================
-- Migration 0002: Status machine triggers for support_tickets
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: validate transition + apply side-effect timestamps
-- ---------------------------------------------------------------------------
create or replace function enforce_ticket_status_transition()
returns trigger language plpgsql as $$
begin
  -- No-op if status hasn't changed
  if old.status = new.status then
    return new;
  end if;

  -- Validate against the allow-list
  if not exists (
    select 1 from status_transitions
    where coalesce(from_status, '') = coalesce(old.status, '')
      and to_status = new.status
  ) then
    raise exception 'invalid status transition % -> %', old.status, new.status;
  end if;

  -- Side-effect timestamps
  case new.status
    when 'ASSIGNED' then
      new.assigned_at = now();

    when 'RESOLVED' then
      new.resolved_at = now();
      new.reopen_window_expires_at = now() + interval '72 hours';

    when 'CLOSED' then
      new.closed_at = now();

    when 'ESCALATED' then
      new.escalated_at = now();

    else null;
  end case;

  return new;
end $$;

create trigger trg_enforce_ticket_status_transition
  before update of status on support_tickets
  for each row execute function enforce_ticket_status_transition();

-- ---------------------------------------------------------------------------
-- AFTER UPDATE: write ticket_status_history
-- Status history is ONLY written by this trigger, never by application code.
-- ---------------------------------------------------------------------------
create or replace function log_ticket_status_change()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    insert into ticket_status_history
      (ticket_id, changed_by, from_status, to_status)
    values
      (new.ticket_id, auth.uid(), old.status, new.status);
  end if;
  return null;
end $$;

create trigger trg_log_ticket_status_change
  after update of status on support_tickets
  for each row execute function log_ticket_status_change();
