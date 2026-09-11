-- =============================================================================
-- Migration 0007: Analytics views (security_invoker — SA only via RLS)
-- All figures live-derived; nothing stored.
-- =============================================================================

-- Average resolution time by priority_label (last 30 days)
create or replace view analytics_resolution_time
  with (security_invoker = true) as
select
  priority_label,
  count(*) as ticket_count,
  round(avg(extract(epoch from (resolved_at - created_at)) / 60)::numeric, 1)
    as avg_resolution_minutes
from support_tickets
where resolved_at is not null
  and created_at > now() - interval '30 days'
group by priority_label;

-- Tickets by category (last 30 days)
create or replace view analytics_tickets_by_category
  with (security_invoker = true) as
select
  c.name as category,
  count(*) as ticket_count,
  count(*) filter (where t.status = 'RESOLVED') as resolved_count,
  count(*) filter (where t.status = 'CLOSED')   as closed_count
from support_tickets t
join complaint_categories c on c.id = t.category_id
where t.created_at > now() - interval '30 days'
group by c.name;

-- Agent load (current snapshot)
create or replace view analytics_agent_load
  with (security_invoker = true) as
select
  a.admin_id,
  a.display_name,
  a.agent_status,
  a.active_chat_count,
  a.accepting_new_chats,
  count(t.ticket_id) filter (where t.status in ('ASSIGNED','ACTIVE','WAITING_ON_USER'))
    as total_assigned
from admin_users a
left join support_tickets t on t.assigned_agent_id = a.admin_id
group by a.admin_id, a.display_name, a.agent_status, a.active_chat_count, a.accepting_new_chats;

-- CSAT (ratings, last 30 days)
create or replace view analytics_csat
  with (security_invoker = true) as
select
  round(avg(rating)::numeric, 2) as avg_rating,
  count(*) as rated_count,
  count(*) filter (where rating = 5) as five_star,
  count(*) filter (where rating >= 4) as four_plus
from support_tickets
where rating is not null
  and created_at > now() - interval '30 days';

-- SLA breach summary (first response)
create or replace view analytics_sla_breach
  with (security_invoker = true) as
select
  t.priority_label,
  count(*) as total,
  count(*) filter (
    where t.first_response_at is not null
      and extract(epoch from (t.first_response_at - t.created_at)) * 1000 <= s.first_response_ms
  ) as within_sla,
  count(*) filter (
    where t.first_response_at is null
      or extract(epoch from (t.first_response_at - t.created_at)) * 1000 > s.first_response_ms
  ) as breached
from support_tickets t
join sla_targets s on s.priority_label = t.priority_label
where t.created_at > now() - interval '30 days'
group by t.priority_label, s.first_response_ms;

-- Analytics views: grant SELECT here (after the views exist).
-- security_invoker = true means underlying-table RLS still applies per user.
GRANT SELECT ON
  analytics_resolution_time, analytics_tickets_by_category,
  analytics_agent_load, analytics_csat, analytics_sla_breach
TO authenticated;

