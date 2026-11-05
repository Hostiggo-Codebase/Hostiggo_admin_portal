-- Run on the primary admin portal Supabase project.
-- Return only the fields needed by the admin queue so it can show a disabled
-- Taken button without exposing chat bodies or customer profile data.
CREATE OR REPLACE FUNCTION public.get_admin_queue_tickets()
RETURNS TABLE (
  ticket_id uuid,
  ticket_number text,
  subject text,
  status text,
  priority integer,
  priority_label text,
  queued_at timestamptz,
  assigned_at timestamptz,
  first_response_at timestamptz,
  created_at timestamptz,
  assigned_agent_id uuid,
  category_name text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT t.ticket_id, t.ticket_number, t.subject, t.status, t.priority,
         t.priority_label, t.queued_at, t.assigned_at, t.first_response_at,
         t.created_at, t.assigned_agent_id, c."name"::text AS category_name
  FROM public.support_tickets AS t
  LEFT JOIN public.complaint_categories AS c ON c.id = t.category_id
  WHERE (auth.jwt() -> 'app_metadata' ->> 'role') IN ('agent', 'super_admin')
  ORDER BY t.priority ASC, t.queued_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_admin_queue_tickets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_queue_tickets() TO authenticated;
