-- =============================================================================
-- Migration 0003: Assignment engine RPC + triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Rate limiting: max 10 messages per sender per ticket per 60 seconds
-- ---------------------------------------------------------------------------
create or replace function enforce_message_rate_limit()
returns trigger language plpgsql as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from chat_messages
  where ticket_id = new.ticket_id
    and sender_id = new.sender_id
    and created_at > now() - interval '60 seconds';

  if recent_count >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_message_rate_limit on chat_messages;
create trigger trg_enforce_message_rate_limit
  before insert on chat_messages
  for each row execute function enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- assign_next_ticket(): the core assignment RPC
-- Prefers returning the same agent to a reopened ticket when eligible.
-- Called repeatedly (while result != null) to drain the queue.
-- ---------------------------------------------------------------------------
create or replace function assign_next_ticket()
returns uuid
language plpgsql security definer as $$
declare
  v_ticket        uuid;
  v_agent         uuid;
  v_parent_agent  uuid;
begin
  -- 1. Try to pick a REOPENED ticket whose parent's last agent is still eligible
  select t.ticket_id, t2.assigned_agent_id
    into v_ticket, v_parent_agent
  from support_tickets t
  join support_tickets t2 on t2.ticket_id = t.parent_ticket_id
  where t.status = 'REOPENED'
    and t2.assigned_agent_id is not null
  order by t.priority asc, t.queued_at asc
  for update of t skip locked
  limit 1;

  if v_ticket is not null and v_parent_agent is not null then
    -- Check whether that preferred agent is eligible
    select admin_id into v_agent
    from admin_users
    where admin_id = v_parent_agent
      and agent_status = 'ONLINE'
      and accepting_new_chats
      and active_chat_count < 2
    for update skip locked;
  end if;

  -- 2. If no preferred-agent match, do the generic QUEUED/REOPENED pick
  if v_ticket is null or v_agent is null then
    v_agent := null;  -- reset in case partial match above

    select ticket_id into v_ticket
    from support_tickets
    where status in ('QUEUED', 'REOPENED')
    order by priority asc, queued_at asc
    for update skip locked
    limit 1;

    if v_ticket is null then return null; end if;

    select admin_id into v_agent
    from admin_users
    where agent_status = 'ONLINE'
      and accepting_new_chats
      and active_chat_count < 2
    order by active_chat_count asc, last_action_at asc
    for update skip locked
    limit 1;

    if v_agent is null then return null; end if;
  end if;

  -- 3. Assign ticket + increment agent slot
  update support_tickets
    set status = 'ASSIGNED',
        assigned_agent_id = v_agent
  where ticket_id = v_ticket;

  update admin_users
    set active_chat_count = active_chat_count + 1
  where admin_id = v_agent;

  -- 4. Notify agent
  insert into notifications (user_id, ticket_id, type, payload)
  values (
    v_agent,
    v_ticket,
    'ASSIGNED',
    jsonb_build_object('ticket_id', v_ticket)
  );

  return v_ticket;
end $$;

-- ---------------------------------------------------------------------------
-- Trigger: on new ticket INSERT → try to assign immediately
-- ---------------------------------------------------------------------------
create or replace function on_ticket_insert_assign()
returns trigger language plpgsql security definer as $$
declare
  v_assigned uuid;
begin
  -- Only try if ticket landed in QUEUED status
  if new.status = 'QUEUED' then
    v_assigned := assign_next_ticket();
  end if;
  return null;
end $$;

drop trigger if exists trg_on_ticket_insert_assign on support_tickets;
create trigger trg_on_ticket_insert_assign
  after insert on support_tickets
  for each row execute function on_ticket_insert_assign();

-- ---------------------------------------------------------------------------
-- Helper: release_agent_slot(agent_id)
-- Decrements active_chat_count then drains the queue.
-- Called by RPCs after RESOLVED / CLOSED / ESCALATED / transfer.
-- ---------------------------------------------------------------------------
create or replace function release_agent_slot(p_agent_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_result uuid;
begin
  update admin_users
    set active_chat_count = greatest(0, active_chat_count - 1)
  where admin_id = p_agent_id;

  -- Drain queue
  loop
    v_result := assign_next_ticket();
    exit when v_result is null;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: set_agent_presence(status, accepting)
-- Syncs Presence channel state into admin_users; triggers queue drain on ONLINE.
-- ---------------------------------------------------------------------------
create or replace function set_agent_presence(
  p_status    text,
  p_accepting boolean
)
returns void
language plpgsql security definer as $$
declare
  v_caller uuid := auth.uid();
  v_result uuid;
begin
  update admin_users
    set agent_status        = p_status,
        accepting_new_chats = p_accepting,
        last_action_at      = now()
  where admin_id = v_caller;

  if p_status = 'ONLINE' and p_accepting then
    loop
      v_result := assign_next_ticket();
      exit when v_result is null;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: heartbeat() — agent keepalive, drives inactivity detection
-- ---------------------------------------------------------------------------
create or replace function heartbeat()
returns void
language plpgsql security definer as $$
begin
  update admin_users
    set last_action_at = now()
  where admin_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- RPC: create_ticket(...)
-- ---------------------------------------------------------------------------
create or replace function create_ticket(
  p_category_id    uuid,
  p_subject        text,
  p_description    text,
  p_priority_label text,
  p_booking_id     uuid  default null,
  p_property_id    uuid  default null,
  p_deferred_type  text  default null,
  p_callback_phone text  default null,
  p_callback_slot  timestamptz default null
)
returns jsonb
language plpgsql security definer as $$
declare
  v_user_id    uuid := auth.uid();
  v_ticket_id  uuid;
  v_status     text;
  v_queue_count int;
  v_max_queue  int;
  v_existing   uuid;
  v_priority   int;
begin
  -- Duplicate check (P-dup): same user, same category + booking, non-CLOSED
  select ticket_id into v_existing
  from support_tickets
  where user_id     = v_user_id
    and category_id = p_category_id
    and (p_booking_id is null or booking_id = p_booking_id)
    and status != 'CLOSED'
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('existing_ticket_id', v_existing, 'duplicate', true);
  end if;

  -- Derive numeric priority from label
  v_priority := case p_priority_label
    when 'Urgent'         then 1
    when 'Payment-Refund' then 2
    when 'Booking Help'   then 3
    else 4
  end;

  -- Queue overflow check
  select count(*) into v_queue_count
  from support_tickets where status = 'QUEUED';

  select value::int into v_max_queue from system_config where key = 'MAX_QUEUE';

  if v_queue_count >= v_max_queue then
    v_status := 'DEFERRED';
  else
    v_status := 'QUEUED';
  end if;

  -- Insert ticket
  insert into support_tickets (
    user_id, category_id, subject, description,
    status, priority, priority_label,
    booking_id, property_id,
    deferred_type, callback_phone, callback_slot,
    queued_at
  ) values (
    v_user_id, p_category_id, p_subject, p_description,
    v_status, v_priority, p_priority_label,
    p_booking_id, p_property_id,
    p_deferred_type, p_callback_phone, p_callback_slot,
    now()
  )
  returning ticket_id into v_ticket_id;

  -- System: opening message
  insert into chat_messages (ticket_id, sender_id, sender_type, body)
  values (v_ticket_id, v_user_id, 'user', p_description);

  return jsonb_build_object(
    'ticket_id', v_ticket_id,
    'status',    v_status,
    'duplicate', false
  );
end $$;

-- ---------------------------------------------------------------------------
-- RPC: send_message(ticket_id, body, is_internal_note)
-- ---------------------------------------------------------------------------
create or replace function send_message(
  p_ticket_id       uuid,
  p_body            text,
  p_is_internal_note boolean default false
)
returns uuid
language plpgsql security definer as $$
declare
  v_caller      uuid := auth.uid();
  v_sender_type text;
  v_ticket      support_tickets%rowtype;
  v_msg_id      uuid;
begin
  select * into v_ticket from support_tickets where ticket_id = p_ticket_id for update;
  if not found then raise exception 'ticket not found'; end if;

  -- Determine sender type
  if exists (select 1 from admin_users where admin_id = v_caller) then
    v_sender_type := 'agent';
  else
    v_sender_type := 'user';
    -- Internal notes are agent-only
    if p_is_internal_note then
      raise exception 'users cannot send internal notes';
    end if;
  end if;

  insert into chat_messages (ticket_id, sender_id, sender_type, body, is_internal_note)
  values (p_ticket_id, v_caller, v_sender_type, p_body, p_is_internal_note)
  returning id into v_msg_id;

  -- Set first_response_at on first agent message
  if v_sender_type = 'agent' and v_ticket.first_response_at is null then
    update support_tickets
      set first_response_at = now()
    where ticket_id = p_ticket_id;
  end if;

  -- Update activity timestamps
  if v_sender_type = 'user' then
    update support_tickets
      set last_user_activity = now()
    where ticket_id = p_ticket_id;
  else
    update admin_users
      set last_action_at = now()
    where admin_id = v_caller;
  end if;

  -- ASSIGNED → ACTIVE on first real exchange (agent sent message)
  if v_sender_type = 'agent' and v_ticket.status = 'ASSIGNED' then
    update support_tickets
      set status = 'ACTIVE'
    where ticket_id = p_ticket_id;
  end if;

  -- Notify: new message to the other party
  if v_sender_type = 'agent' and not p_is_internal_note then
    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_ticket.user_id, p_ticket_id, 'NEW_MESSAGE',
      jsonb_build_object('message_id', v_msg_id, 'sender_type', v_sender_type)
    );
  elsif v_sender_type = 'user' and v_ticket.assigned_agent_id is not null then
    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_ticket.assigned_agent_id, p_ticket_id, 'NEW_MESSAGE',
      jsonb_build_object('message_id', v_msg_id, 'sender_type', v_sender_type)
    );
  end if;

  return v_msg_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: change_status(ticket_id, new_status, note)
-- ---------------------------------------------------------------------------
create or replace function change_status(
  p_ticket_id  uuid,
  p_new_status text,
  p_note       text default null
)
returns void
language plpgsql security definer as $$
declare
  v_caller uuid := auth.uid();
  v_role   text;
begin
  select (auth.jwt() -> 'app_metadata' ->> 'role') into v_role;

  if v_role not in ('agent', 'super_admin') then
    raise exception 'insufficient role';
  end if;

  update support_tickets
    set status = p_new_status
  where ticket_id = p_ticket_id;

  insert into audit_logs (admin_id, ticket_id, action, previous_value, new_value)
  select v_caller, p_ticket_id, 'STATUS_CHANGE',
    jsonb_build_object('status', old.status),
    jsonb_build_object('status', p_new_status, 'note', p_note)
  from support_tickets old
  where old.ticket_id = p_ticket_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: escalate_ticket(ticket_id, reason)
-- ---------------------------------------------------------------------------
create or replace function escalate_ticket(
  p_ticket_id uuid,
  p_reason    text
)
returns void
language plpgsql security definer as $$
declare
  v_caller   uuid := auth.uid();
  v_ticket   support_tickets%rowtype;
  v_sa       record;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') != 'agent' then
    raise exception 'only agents can escalate';
  end if;

  select * into v_ticket from support_tickets where ticket_id = p_ticket_id for update;

  update support_tickets
    set status       = 'ESCALATED',
        escalated_by = v_caller
  where ticket_id = p_ticket_id;

  -- Release agent slot
  perform release_agent_slot(v_caller);

  -- System message in chat
  insert into chat_messages (ticket_id, sender_id, sender_type, body)
  values (
    p_ticket_id, v_caller, 'system',
    'Ticket escalated to Super Admin. Reason: ' || p_reason
  );

  -- Notify all Super Admins
  for v_sa in
    select admin_id from admin_users where role = 'SUPER_ADMIN'
  loop
    insert into notifications (user_id, ticket_id, type, payload)
    values (
      v_sa.admin_id, p_ticket_id, 'ESCALATED',
      jsonb_build_object('reason', p_reason, 'escalated_by', v_caller)
    );
  end loop;

  insert into audit_logs (admin_id, ticket_id, action, previous_value, new_value)
  values (
    v_caller, p_ticket_id, 'ESCALATED',
    jsonb_build_object('status', v_ticket.status),
    jsonb_build_object('status', 'ESCALATED', 'reason', p_reason)
  );
end $$;

-- ---------------------------------------------------------------------------
-- RPC: resolve_escalation(ticket_id, decision, note)
-- decision: 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'SEND_BACK'
-- ---------------------------------------------------------------------------
create or replace function resolve_escalation(
  p_ticket_id uuid,
  p_decision  text,
  p_note      text default null
)
returns void
language plpgsql security definer as $$
declare
  v_caller  uuid := auth.uid();
  v_ticket  support_tickets%rowtype;
  v_action  text;
  v_new_status text;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') != 'super_admin' then
    raise exception 'only super admins can resolve escalations';
  end if;

  select * into v_ticket
  from support_tickets where ticket_id = p_ticket_id;

  if v_ticket.status != 'ESCALATED' then
    raise exception 'ticket is not escalated';
  end if;

  case p_decision
    when 'REFUND_APPROVED' then
      v_action     := 'REFUND_APPROVED';
      v_new_status := 'RESOLVED';
    when 'REFUND_REJECTED' then
      v_action     := 'REFUND_REJECTED';
      v_new_status := 'RESOLVED';
    when 'SEND_BACK' then
      v_action     := 'STATUS_CHANGE';
      v_new_status := 'ACTIVE';
    else
      raise exception 'invalid decision %', p_decision;
  end case;

  update support_tickets set status = v_new_status where ticket_id = p_ticket_id;

  insert into audit_logs (admin_id, ticket_id, action, previous_value, new_value)
  values (
    v_caller, p_ticket_id, v_action,
    jsonb_build_object('status', 'ESCALATED'),
    jsonb_build_object('status', v_new_status, 'note', p_note, 'decision', p_decision)
  );
end $$;

-- ---------------------------------------------------------------------------
-- RPC: transfer_ticket(ticket_id, to_agent)
-- ---------------------------------------------------------------------------
create or replace function transfer_ticket(
  p_ticket_id uuid,
  p_to_agent  uuid
)
returns void
language plpgsql security definer as $$
declare
  v_caller  uuid := auth.uid();
  v_ticket  support_tickets%rowtype;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') not in ('agent', 'super_admin') then
    raise exception 'insufficient role';
  end if;

  select * into v_ticket from support_tickets where ticket_id = p_ticket_id for update;

  -- Check destination agent capacity
  if not exists (
    select 1 from admin_users
    where admin_id = p_to_agent
      and agent_status = 'ONLINE'
      and accepting_new_chats
      and active_chat_count < 2
  ) then
    raise exception 'target agent is unavailable or at capacity';
  end if;

  -- Release from current agent, assign to new
  if v_ticket.assigned_agent_id is not null then
    update admin_users
      set active_chat_count = greatest(0, active_chat_count - 1)
    where admin_id = v_ticket.assigned_agent_id;
  end if;

  update support_tickets
    set assigned_agent_id = p_to_agent,
        transferred_from  = v_caller::uuid,
        transfer_count    = transfer_count + 1
  where ticket_id = p_ticket_id;

  update admin_users
    set active_chat_count = active_chat_count + 1
  where admin_id = p_to_agent;

  -- System message
  insert into chat_messages (ticket_id, sender_id, sender_type, body)
  values (p_ticket_id, v_caller, 'system', 'Ticket transferred to another agent.');

  insert into audit_logs (admin_id, ticket_id, action, previous_value, new_value)
  values (
    v_caller, p_ticket_id, 'TRANSFERRED',
    jsonb_build_object('agent', v_ticket.assigned_agent_id),
    jsonb_build_object('agent', p_to_agent)
  );
end $$;

-- ---------------------------------------------------------------------------
-- RPC: reopen_ticket(ticket_id, reason)
-- ---------------------------------------------------------------------------
create or replace function reopen_ticket(
  p_ticket_id uuid,
  p_reason    text
)
returns void
language plpgsql security definer as $$
declare
  v_caller uuid := auth.uid();
  v_ticket support_tickets%rowtype;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') != 'user' then
    raise exception 'only users can reopen tickets';
  end if;

  select * into v_ticket from support_tickets
  where ticket_id = p_ticket_id and user_id = v_caller
  for update;

  if not found then raise exception 'ticket not found'; end if;

  if v_ticket.status not in ('RESOLVED', 'CLOSED') then
    raise exception 'ticket is not resolved or closed';
  end if;

  if now() > v_ticket.reopen_window_expires_at then
    raise exception 'reopen window has expired';
  end if;

  update support_tickets
    set status         = 'REOPENED',
        priority       = 1,
        priority_label = 'Urgent',
        parent_ticket_id = coalesce(v_ticket.parent_ticket_id, v_ticket.ticket_id),
        queued_at      = now()
  where ticket_id = p_ticket_id;

  insert into chat_messages (ticket_id, sender_id, sender_type, body)
  values (p_ticket_id, v_caller, 'user', 'Reopened: ' || p_reason);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: rate_ticket(ticket_id, rating, comment)
-- ---------------------------------------------------------------------------
create or replace function rate_ticket(
  p_ticket_id uuid,
  p_rating    int,
  p_comment   text default null
)
returns void
language plpgsql security definer as $$
declare
  v_caller uuid := auth.uid();
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  update support_tickets
    set rating         = p_rating,
        rating_comment = p_comment
  where ticket_id = p_ticket_id
    and user_id   = v_caller
    and status in ('RESOLVED', 'CLOSED');

  if not found then
    raise exception 'ticket not found or not eligible for rating';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: set_disconnect_grace(ticket_id)
-- Called by the client on chat unmount / page hide.
-- ---------------------------------------------------------------------------
create or replace function set_disconnect_grace(p_ticket_id uuid)
returns void
language plpgsql security definer as $$
begin
  update support_tickets
    set disconnect_grace_expires_at = now() + interval '15 minutes'
  where ticket_id = p_ticket_id
    and user_id   = auth.uid();
end $$;
