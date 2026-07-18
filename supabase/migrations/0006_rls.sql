-- =============================================================================
-- Migration 0006: Row-Level Security policies
-- =============================================================================

-- Helper shorthand
-- auth.jwt() -> 'app_metadata' ->> 'role'  returns 'user' | 'agent' | 'super_admin'

-- ---------------------------------------------------------------------------
-- complaint_categories — readable by all authenticated users
-- ---------------------------------------------------------------------------
alter table complaint_categories enable row level security;

create policy "categories_select_authenticated"
  on complaint_categories for select
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------
alter table admin_users enable row level security;

create policy "admin_users_select_self"
  on admin_users for select
  using (
    admin_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- No direct INSERT/UPDATE/DELETE — all via RPCs (security definer)

-- ---------------------------------------------------------------------------
-- admin_shifts — SA can manage, agents can read own
-- ---------------------------------------------------------------------------
alter table admin_shifts enable row level security;

create policy "admin_shifts_select"
  on admin_shifts for select
  using (
    admin_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

create policy "admin_shifts_insert_sa"
  on admin_shifts for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

create policy "admin_shifts_update_sa"
  on admin_shifts for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
alter table support_tickets enable row level security;

-- Users see only their own tickets
create policy "tickets_select_user"
  on support_tickets for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'user'
    and user_id = auth.uid()
  );

-- Agents see: their assigned tickets + anything in QUEUED/REOPENED (queue view)
create policy "tickets_select_agent"
  on support_tickets for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
    and (
      assigned_agent_id = auth.uid()
      or status in ('QUEUED', 'REOPENED')
    )
  );

-- Super Admins see everything
create policy "tickets_select_sa"
  on support_tickets for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- No direct INSERT/UPDATE — all via RPCs

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
alter table chat_messages enable row level security;

-- Users: own-ticket messages, non-internal only
create policy "messages_select_user"
  on chat_messages for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'user'
    and is_internal_note = false
    and exists (
      select 1 from support_tickets t
      where t.ticket_id = chat_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

-- Agents: messages on assigned tickets (all including internal notes)
create policy "messages_select_agent"
  on chat_messages for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
    and exists (
      select 1 from support_tickets t
      where t.ticket_id = chat_messages.ticket_id
        and t.assigned_agent_id = auth.uid()
    )
  );

-- SA: all messages
create policy "messages_select_sa"
  on chat_messages for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- No direct INSERT — via send_message RPC

-- ---------------------------------------------------------------------------
-- message_attachments — mirrors chat_messages access
-- ---------------------------------------------------------------------------
alter table message_attachments enable row level security;

create policy "attachments_select_user"
  on message_attachments for select
  using (
    exists (
      select 1 from chat_messages m
      join support_tickets t on t.ticket_id = m.ticket_id
      where m.id = message_attachments.message_id
        and m.is_internal_note = false
        and t.user_id = auth.uid()
        and (auth.jwt() -> 'app_metadata' ->> 'role') = 'user'
    )
  );

create policy "attachments_select_agent"
  on message_attachments for select
  using (
    exists (
      select 1 from chat_messages m
      join support_tickets t on t.ticket_id = m.ticket_id
      where m.id = message_attachments.message_id
        and t.assigned_agent_id = auth.uid()
        and (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
    )
  );

create policy "attachments_select_sa"
  on message_attachments for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- Users and agents can insert attachments via their own messages
create policy "attachments_insert_own_message"
  on message_attachments for insert
  with check (
    exists (
      select 1 from chat_messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- ticket_status_history — agents/SA read their scope; no client writes
-- ---------------------------------------------------------------------------
alter table ticket_status_history enable row level security;

create policy "status_history_select_user"
  on ticket_status_history for select
  using (
    exists (
      select 1 from support_tickets t
      where t.ticket_id = ticket_status_history.ticket_id
        and t.user_id = auth.uid()
        and (auth.jwt() -> 'app_metadata' ->> 'role') = 'user'
    )
  );

create policy "status_history_select_agent"
  on ticket_status_history for select
  using (
    exists (
      select 1 from support_tickets t
      where t.ticket_id = ticket_status_history.ticket_id
        and t.assigned_agent_id = auth.uid()
        and (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
    )
  );

create policy "status_history_select_sa"
  on ticket_status_history for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ---------------------------------------------------------------------------
-- notifications — own rows only for select; update only is_read
-- ---------------------------------------------------------------------------
alter table notifications enable row level security;

create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs — SA only; no client writes
-- ---------------------------------------------------------------------------
alter table audit_logs enable row level security;

create policy "audit_logs_select_sa"
  on audit_logs for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ---------------------------------------------------------------------------
-- status_transitions — readable by all authenticated; no client writes
-- ---------------------------------------------------------------------------
alter table status_transitions enable row level security;

create policy "status_transitions_select"
  on status_transitions for select
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- sla_targets — readable by agents/SA
-- ---------------------------------------------------------------------------
alter table sla_targets enable row level security;

create policy "sla_targets_select"
  on sla_targets for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('agent', 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- system_config — readable by agents/SA
-- ---------------------------------------------------------------------------
alter table system_config enable row level security;

create policy "system_config_select"
  on system_config for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('agent', 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- Grants: allow postgrest roles to access public schema
-- RLS policies above are the actual security gatekeepers.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- All direct SELECT access (RLS restricts rows per user)
GRANT SELECT ON
  support_tickets, chat_messages, message_attachments,
  ticket_status_history, notifications, audit_logs,
  admin_users, admin_shifts, complaint_categories,
  sla_targets, status_transitions, system_config
TO authenticated;

-- Analytics views
GRANT SELECT ON
  analytics_resolution_time, analytics_tickets_by_category,
  analytics_agent_load, analytics_csat, analytics_sla_breach
TO authenticated;

-- complaint_categories is public (no sensitive data)
GRANT SELECT ON complaint_categories TO anon;

-- Notifications: users can mark their own as read
GRANT UPDATE (is_read) ON notifications TO authenticated;

-- All RPCs are security definer; just need EXECUTE granted
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
