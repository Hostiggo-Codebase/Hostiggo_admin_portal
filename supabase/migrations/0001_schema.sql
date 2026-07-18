-- =============================================================================
-- Migration 0001: Full schema for Hostiggo Support & Complaint Chat System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utility: updated_at auto-touch trigger function
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4.1  complaint_categories
-- ---------------------------------------------------------------------------
create table complaint_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create trigger trg_complaint_categories_updated_at
  before update on complaint_categories
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4.2  admin_users
-- ---------------------------------------------------------------------------
create table admin_users (
  admin_id           uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null,
  role               text not null check (role in ('ADMIN', 'SUPER_ADMIN')),
  agent_status       text not null default 'OFFLINE'
                       check (agent_status in ('ONLINE', 'OFFLINE', 'INACTIVE')),
  accepting_new_chats boolean not null default false,
  active_chat_count  int not null default 0 check (active_chat_count >= 0),
  last_action_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create trigger trg_admin_users_updated_at
  before update on admin_users
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4.3  admin_shifts
-- ---------------------------------------------------------------------------
create table admin_shifts (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references admin_users (admin_id) on delete cascade,
  shift_date  date not null,
  shift_start timestamptz not null,
  shift_end   timestamptz not null,
  status      text not null default 'SCHEDULED'
                check (status in ('SCHEDULED', 'ACTIVE', 'ENDED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create trigger trg_admin_shifts_updated_at
  before update on admin_shifts
  for each row execute function touch_updated_at();

create index idx_admin_shifts_admin_id on admin_shifts (admin_id);
create index idx_admin_shifts_shift_end on admin_shifts (shift_end) where status != 'ENDED';

-- ---------------------------------------------------------------------------
-- Ticket number sequence
-- ---------------------------------------------------------------------------
create sequence ticket_number_seq start 10001;

-- ---------------------------------------------------------------------------
-- 4.4  support_tickets
-- ---------------------------------------------------------------------------
create table support_tickets (
  ticket_id                  uuid primary key default gen_random_uuid(),
  ticket_number              text unique,
  user_id                    uuid not null references auth.users (id) on delete restrict,
  assigned_agent_id          uuid references admin_users (admin_id) on delete set null,
  category_id                uuid not null references complaint_categories (id),
  booking_id                 uuid,
  property_id                uuid,
  parent_ticket_id           uuid references support_tickets (ticket_id) on delete set null,
  subject                    text not null,
  description                text not null,
  status                     text not null default 'QUEUED',
  priority                   int not null default 4 check (priority between 1 and 4),
  priority_label             text not null
                               check (priority_label in ('Urgent','Payment-Refund','Booking Help','General')),
  deferred_type              text check (deferred_type in ('DEFERRED_TICKET','CALLBACK_REQUEST')),
  callback_phone             text,
  callback_slot              timestamptz,
  transfer_count             int not null default 0,
  transferred_from           uuid references admin_users (admin_id) on delete set null,
  queued_at                  timestamptz not null default now(),
  assigned_at                timestamptz,
  first_response_at          timestamptz,
  last_user_activity         timestamptz,
  disconnect_grace_expires_at timestamptz,
  escalated_at               timestamptz,
  escalated_by               uuid references auth.users (id) on delete set null,
  resolved_at                timestamptz,
  reopen_window_expires_at   timestamptz,
  closed_at                  timestamptz,
  rating                     int check (rating between 1 and 5),
  rating_comment             text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz
);

-- Ticket number via trigger
create or replace function set_ticket_number()
returns trigger language plpgsql as $$
begin
  new.ticket_number = 'HG' || nextval('ticket_number_seq');
  return new;
end $$;

create trigger trg_set_ticket_number
  before insert on support_tickets
  for each row execute function set_ticket_number();

create trigger trg_support_tickets_updated_at
  before update on support_tickets
  for each row execute function touch_updated_at();

create index idx_support_tickets_status_priority_queued
  on support_tickets (status, priority asc, queued_at asc);
create index idx_support_tickets_assigned_agent
  on support_tickets (assigned_agent_id);
create index idx_support_tickets_user_id
  on support_tickets (user_id);
create index idx_support_tickets_category_id
  on support_tickets (category_id);
create index idx_support_tickets_parent_ticket_id
  on support_tickets (parent_ticket_id);

-- ---------------------------------------------------------------------------
-- 4.5  chat_messages
-- ---------------------------------------------------------------------------
create table chat_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references support_tickets (ticket_id) on delete cascade,
  sender_id        uuid not null,  -- validated by trigger, no hard FK
  sender_type      varchar not null check (sender_type in ('user', 'agent', 'system')),
  body             text not null,
  is_internal_note boolean not null default false,
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

-- Validate sender_id against the correct table based on sender_type
create or replace function validate_chat_message_sender()
returns trigger language plpgsql as $$
begin
  if new.sender_type = 'user' then
    if not exists (select 1 from auth.users where id = new.sender_id) then
      raise exception 'sender_id % does not exist in auth.users', new.sender_id;
    end if;
  elsif new.sender_type = 'agent' then
    if not exists (select 1 from admin_users where admin_id = new.sender_id) then
      raise exception 'sender_id % does not exist in admin_users', new.sender_id;
    end if;
  end if;
  -- sender_type = 'system' requires no validation
  return new;
end $$;

create trigger trg_validate_chat_message_sender
  before insert on chat_messages
  for each row execute function validate_chat_message_sender();

create trigger trg_chat_messages_updated_at
  before update on chat_messages
  for each row execute function touch_updated_at();

create index idx_chat_messages_ticket_created
  on chat_messages (ticket_id, created_at);
create index idx_chat_messages_ticket_sender_created
  on chat_messages (ticket_id, sender_id, created_at);

-- ---------------------------------------------------------------------------
-- 4.6  message_attachments
-- ---------------------------------------------------------------------------
create table message_attachments (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages (id) on delete cascade,
  file_url   text not null,
  file_name  text not null,
  file_type  text not null,
  file_size  int not null,
  created_at timestamptz not null default now()
);

create index idx_message_attachments_message_id
  on message_attachments (message_id);

-- ---------------------------------------------------------------------------
-- 4.7  ticket_status_history
-- ---------------------------------------------------------------------------
create table ticket_status_history (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets (ticket_id) on delete cascade,
  changed_by  uuid,  -- nullable for system/cron changes
  from_status text,
  to_status   text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_ticket_status_history_ticket_id
  on ticket_status_history (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- 4.8  notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null,  -- FK to auth.users; checked in RLS
  ticket_id uuid references support_tickets (ticket_id) on delete set null,
  type      text not null
              check (type in (
                'NEW_MESSAGE','STATUS_CHANGE','ASSIGNED','ESCALATED',
                'SHIFT_END','CALLBACK_DUE'
              )),
  payload   jsonb not null default '{}',
  is_read   boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on notifications (user_id, created_at desc);
create index idx_notifications_ticket_id on notifications (ticket_id);

-- ---------------------------------------------------------------------------
-- 4.9  audit_logs
-- ---------------------------------------------------------------------------
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references admin_users (admin_id) on delete set null,
  ticket_id      uuid references support_tickets (ticket_id) on delete set null,
  action         text not null,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz not null default now()
);

create index idx_audit_logs_admin_id on audit_logs (admin_id, created_at desc);
create index idx_audit_logs_ticket_id on audit_logs (ticket_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4.10  status_transitions (allow-list, seeded inline)
-- ---------------------------------------------------------------------------
create table status_transitions (
  from_status text,  -- null means initial creation
  to_status   text not null
);

create unique index uq_status_transitions
  on status_transitions (coalesce(from_status, ''), to_status);

insert into status_transitions (from_status, to_status) values
  (null,               'QUEUED'),
  (null,               'DEFERRED'),
  ('QUEUED',           'ASSIGNED'),
  ('QUEUED',           'DEFERRED'),
  ('ASSIGNED',         'ACTIVE'),
  ('ASSIGNED',         'QUEUED'),
  ('ACTIVE',           'WAITING_ON_USER'),
  ('WAITING_ON_USER',  'ACTIVE'),
  ('ACTIVE',           'ESCALATED'),
  ('ESCALATED',        'ACTIVE'),
  ('ESCALATED',        'RESOLVED'),
  ('ACTIVE',           'RESOLVED'),
  ('WAITING_ON_USER',  'RESOLVED'),
  ('RESOLVED',         'CLOSED'),
  ('RESOLVED',         'REOPENED'),
  ('REOPENED',         'ASSIGNED'),
  ('REOPENED',         'QUEUED'),
  ('DEFERRED',         'QUEUED');

-- ---------------------------------------------------------------------------
-- SLA targets config table
-- ---------------------------------------------------------------------------
create table sla_targets (
  priority_label    text primary key,
  first_response_ms int not null,  -- milliseconds
  resolution_ms     int not null
);

insert into sla_targets (priority_label, first_response_ms, resolution_ms) values
  ('Urgent',         5  * 60 * 1000,   2  * 60 * 60 * 1000),
  ('Payment-Refund', 10 * 60 * 1000,   8  * 60 * 60 * 1000),
  ('Booking Help',   15 * 60 * 1000,   24 * 60 * 60 * 1000),
  ('General',        30 * 60 * 1000,   48 * 60 * 60 * 1000);

-- ---------------------------------------------------------------------------
-- System config table (MAX_QUEUE etc.)
-- ---------------------------------------------------------------------------
create table system_config (
  key   text primary key,
  value text not null
);

insert into system_config (key, value) values
  ('MAX_QUEUE', '25');
