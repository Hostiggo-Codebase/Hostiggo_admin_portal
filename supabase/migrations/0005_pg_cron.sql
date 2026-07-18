-- =============================================================================
-- Migration 0005: pg_cron jobs (run every 5 minutes)
-- =============================================================================

create extension if not exists "pg_cron";

-- ---------------------------------------------------------------------------
-- 1. auto_close_expired
-- RESOLVED tickets past reopen_window_expires_at → CLOSED
-- ---------------------------------------------------------------------------
create or replace function cron_auto_close_expired()
returns void language plpgsql security definer as $$
declare
  v_row record;
begin
  for v_row in
    select ticket_id, user_id
    from support_tickets
    where status = 'RESOLVED'
      and reopen_window_expires_at < now()
  loop
    update support_tickets
      set status = 'CLOSED'
    where ticket_id = v_row.ticket_id;

    insert into chat_messages (ticket_id, sender_id, sender_type, body)
    values (
      v_row.ticket_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'system',
      'Ticket automatically closed after 72-hour reopen window expired.'
    );

    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_row.user_id, v_row.ticket_id, 'STATUS_CHANGE',
      jsonb_build_object('new_status', 'CLOSED', 'reason', 'auto_close')
    );
  end loop;
end $$;

select cron.schedule(
  'auto_close_expired',
  '*/5 * * * *',
  'select cron_auto_close_expired()'
);

-- ---------------------------------------------------------------------------
-- 2. inactivity_sweep
-- Agent last_action_at > 5 min: warn. > 10 min: free slot + re-queue.
-- User last_user_activity > 5 min on ACTIVE: → WAITING_ON_USER + warn.
-- ---------------------------------------------------------------------------
create or replace function cron_inactivity_sweep()
returns void language plpgsql security definer as $$
declare
  v_row record;
begin
  -- Agent-side: warn at 5 min
  for v_row in
    select t.ticket_id, t.assigned_agent_id
    from support_tickets t
    join admin_users a on a.admin_id = t.assigned_agent_id
    where t.status = 'ACTIVE'
      and a.last_action_at < now() - interval '5 minutes'
      and a.last_action_at >= now() - interval '10 minutes'
  loop
    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_row.assigned_agent_id, v_row.ticket_id, 'STATUS_CHANGE',
      jsonb_build_object('warning', 'inactivity_5min')
    );
  end loop;

  -- Agent-side: re-queue at 10 min
  for v_row in
    select t.ticket_id, t.assigned_agent_id
    from support_tickets t
    join admin_users a on a.admin_id = t.assigned_agent_id
    where t.status = 'ACTIVE'
      and a.last_action_at < now() - interval '10 minutes'
  loop
    update support_tickets
      set status            = 'QUEUED',
          assigned_agent_id = null,
          queued_at         = now()
    where ticket_id = v_row.ticket_id;

    perform release_agent_slot(v_row.assigned_agent_id);

    insert into chat_messages (ticket_id, sender_id, sender_type, body)
    values (
      v_row.ticket_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'system',
      'Agent inactive — ticket returned to queue.'
    );
  end loop;

  -- User-side: ACTIVE → WAITING_ON_USER after 5 min no activity
  for v_row in
    select ticket_id, assigned_agent_id
    from support_tickets
    where status = 'ACTIVE'
      and (last_user_activity is null or last_user_activity < now() - interval '5 minutes')
  loop
    update support_tickets
      set status = 'WAITING_ON_USER'
    where ticket_id = v_row.ticket_id;

    insert into chat_messages (ticket_id, sender_id, sender_type, body)
    values (
      v_row.ticket_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'system',
      'Waiting for user response.'
    );

    if v_row.assigned_agent_id is not null then
      insert into notifications (user_id, ticket_id, type, payload)
      values (
        v_row.assigned_agent_id, v_row.ticket_id, 'STATUS_CHANGE',
        jsonb_build_object('new_status', 'WAITING_ON_USER')
      );
    end if;
  end loop;
end $$;

select cron.schedule(
  'inactivity_sweep',
  '*/5 * * * *',
  'select cron_inactivity_sweep()'
);

-- ---------------------------------------------------------------------------
-- 3. disconnect_grace
-- disconnect_grace_expires_at < now() → RESOLVED with system message
-- ---------------------------------------------------------------------------
create or replace function cron_disconnect_grace()
returns void language plpgsql security definer as $$
declare
  v_row record;
begin
  for v_row in
    select ticket_id, user_id, assigned_agent_id
    from support_tickets
    where disconnect_grace_expires_at is not null
      and disconnect_grace_expires_at < now()
      and status not in ('RESOLVED', 'CLOSED')
  loop
    update support_tickets
      set status = 'RESOLVED',
          disconnect_grace_expires_at = null
    where ticket_id = v_row.ticket_id;

    if v_row.assigned_agent_id is not null then
      perform release_agent_slot(v_row.assigned_agent_id);
    end if;

    insert into chat_messages (ticket_id, sender_id, sender_type, body)
    values (
      v_row.ticket_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'system',
      'User disconnected and did not return within the 15-minute window. Ticket auto-resolved.'
    );

    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_row.user_id, v_row.ticket_id, 'STATUS_CHANGE',
      jsonb_build_object('new_status', 'RESOLVED', 'reason', 'disconnect_grace')
    );
  end loop;
end $$;

select cron.schedule(
  'disconnect_grace',
  '*/5 * * * *',
  'select cron_disconnect_grace()'
);

-- ---------------------------------------------------------------------------
-- 4. shift_end_warning
-- Agents with shift ending in < 15 min → accepting_new_chats = false + notify.
-- Agents at shift end still with active chats → prompt transfer.
-- ---------------------------------------------------------------------------
create or replace function cron_shift_end_warning()
returns void language plpgsql security definer as $$
declare
  v_row record;
begin
  -- Warning window: shift ends within 15 min
  for v_row in
    select distinct s.admin_id
    from admin_shifts s
    join admin_users a on a.admin_id = s.admin_id
    where s.status = 'ACTIVE'
      and s.shift_end between now() and now() + interval '15 minutes'
      and a.accepting_new_chats = true
  loop
    update admin_users
      set accepting_new_chats = false
    where admin_id = v_row.admin_id;

    insert into notifications (user_id, type, payload)
    values (
      v_row.admin_id, 'SHIFT_END',
      jsonb_build_object('warning', 'shift_ends_15min')
    );
  end loop;

  -- Shift has ended: mark shift ENDED, prompt transfer for active chats
  for v_row in
    select distinct s.admin_id, s.id as shift_id
    from admin_shifts s
    where s.status = 'ACTIVE'
      and s.shift_end <= now()
  loop
    update admin_shifts set status = 'ENDED' where id = v_row.shift_id;
    update admin_users
      set agent_status = 'OFFLINE', accepting_new_chats = false
    where admin_id = v_row.admin_id;

    -- Prompt for tickets still assigned to this agent
    if exists (
      select 1 from support_tickets
      where assigned_agent_id = v_row.admin_id
        and status in ('ASSIGNED', 'ACTIVE', 'WAITING_ON_USER')
    ) then
      insert into notifications (user_id, type, payload)
      values (
        v_row.admin_id, 'SHIFT_END',
        jsonb_build_object('action_required', 'transfer_active_chats')
      );
    end if;
  end loop;
end $$;

select cron.schedule(
  'shift_end_warning',
  '*/5 * * * *',
  'select cron_shift_end_warning()'
);

-- ---------------------------------------------------------------------------
-- 5. requeue_deferred
-- If QUEUED count < threshold, flip oldest DEFERRED_TICKET → QUEUED
-- ---------------------------------------------------------------------------
create or replace function cron_requeue_deferred()
returns void language plpgsql security definer as $$
declare
  v_queue_count int;
  v_max_queue   int;
  v_ticket_id   uuid;
begin
  select count(*) into v_queue_count from support_tickets where status = 'QUEUED';
  select value::int into v_max_queue from system_config where key = 'MAX_QUEUE';

  while v_queue_count < v_max_queue loop
    select ticket_id into v_ticket_id
    from support_tickets
    where status = 'DEFERRED'
      and deferred_type = 'DEFERRED_TICKET'
    order by queued_at asc
    for update skip locked
    limit 1;

    exit when v_ticket_id is null;

    update support_tickets
      set status    = 'QUEUED',
          queued_at = now()
    where ticket_id = v_ticket_id;

    v_queue_count := v_queue_count + 1;
    perform assign_next_ticket();
    v_ticket_id := null;
  end loop;
end $$;

select cron.schedule(
  'requeue_deferred',
  '*/5 * * * *',
  'select cron_requeue_deferred()'
);

-- ---------------------------------------------------------------------------
-- 6. callback_due
-- callback_slot within next 15 min → CALLBACK_DUE notification to available agent
-- ---------------------------------------------------------------------------
create or replace function cron_callback_due()
returns void language plpgsql security definer as $$
declare
  v_row   record;
  v_agent uuid;
begin
  for v_row in
    select ticket_id, user_id, callback_slot
    from support_tickets
    where status = 'DEFERRED'
      and deferred_type = 'CALLBACK_REQUEST'
      and callback_slot between now() and now() + interval '15 minutes'
  loop
    -- Find an available agent
    select admin_id into v_agent
    from admin_users
    where agent_status = 'ONLINE'
      and accepting_new_chats
      and active_chat_count < 2
    order by active_chat_count asc, last_action_at asc
    limit 1;

    if v_agent is not null then
      insert into notifications (user_id, ticket_id, type, payload)
      values (
        v_agent, v_row.ticket_id, 'CALLBACK_DUE',
        jsonb_build_object('callback_slot', v_row.callback_slot, 'ticket_id', v_row.ticket_id)
      );
    end if;
  end loop;
end $$;

select cron.schedule(
  'callback_due',
  '*/5 * * * *',
  'select cron_callback_due()'
);
