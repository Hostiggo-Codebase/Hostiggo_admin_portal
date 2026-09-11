-- =============================================================================
-- Migration 0011: Batch review-queue system
--
-- Replaces the pull-based assignment engine with a simplified workflow:
--   NOT_REVIEWED (QUEUED) → IN_REVIEW (ACTIVE) → RESOLVED / AWAITING_USER_ACTION
--
-- Note: ticket_status_history is written automatically by the AFTER UPDATE
-- trigger in migration 0002 (trg_log_ticket_status_change).  The RPCs here
-- must NOT insert into it manually — that would create duplicate rows.
-- =============================================================================

-- 1. Allow the direct QUEUED → ACTIVE path (no intermediate ASSIGNED step)
insert into status_transitions (from_status, to_status)
values ('QUEUED', 'ACTIVE')
on conflict do nothing;

-- Allow WAITING_ON_USER → RESOLVED directly
insert into status_transitions (from_status, to_status)
values ('WAITING_ON_USER', 'RESOLVED')
on conflict do nothing;


-- 2. take_ticket: claim one specific QUEUED ticket for the calling agent
create or replace function take_ticket(p_ticket_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_role           text;
  v_current_status text;
begin
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  if v_role not in ('agent', 'super_admin') then
    raise exception 'PERMISSION_DENIED';
  end if;

  -- Lock the row so two agents can't double-claim the same ticket
  select status into v_current_status
  from support_tickets
  where ticket_id = p_ticket_id
  for update;

  if v_current_status is null then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if v_current_status != 'QUEUED' then
    raise exception 'TICKET_NOT_QUEUED — current status: %', v_current_status;
  end if;

  -- Status change triggers (0002) handle the history insert automatically
  update support_tickets
  set status            = 'ACTIVE',
      assigned_agent_id = auth.uid(),
      assigned_at       = now()
  where ticket_id = p_ticket_id;
end;
$$;


-- 3. fetch_review_batch: claim up to p_limit QUEUED records in priority order.
--    SKIP LOCKED ensures two concurrent calls never grab the same record.
--    Returns the ticket_ids of the claimed records.
create or replace function fetch_review_batch(p_limit int default 10)
returns setof uuid
language plpgsql security definer as $$
declare
  v_role      text;
  v_ticket_id uuid;
begin
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  if v_role not in ('agent', 'super_admin') then
    raise exception 'PERMISSION_DENIED';
  end if;

  for v_ticket_id in
    select ticket_id
    from support_tickets
    where status = 'QUEUED'
    order by priority asc, queued_at asc
    limit p_limit
    for update skip locked
  loop
    -- Trigger handles history; just update the row
    update support_tickets
    set status            = 'ACTIVE',
        assigned_agent_id = auth.uid(),
        assigned_at       = now()
    where ticket_id = v_ticket_id;

    return next v_ticket_id;
  end loop;
end;
$$;
