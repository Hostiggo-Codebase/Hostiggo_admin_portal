-- Run on the primary admin portal Supabase project.
-- Ownership for mobile/secondary-project tickets lives here, so the secondary
-- customer database does not need assignment columns or policy changes.

CREATE TABLE IF NOT EXISTS public.external_ticket_assignments (
  ticket_id uuid PRIMARY KEY,
  assigned_agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_ticket_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_external_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_owner uuid;
  v_inserted integer;
BEGIN
  IF v_role NOT IN ('agent', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  INSERT INTO public.external_ticket_assignments (ticket_id, assigned_agent_id)
  VALUES (p_ticket_id, auth.uid())
  ON CONFLICT (ticket_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT assigned_agent_id INTO v_owner
  FROM public.external_ticket_assignments
  WHERE ticket_id = p_ticket_id
  FOR UPDATE;

  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'TICKET_ALREADY_TAKEN';
  END IF;
  RETURN v_inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_external_ticket_owner(p_ticket_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_owner uuid;
BEGIN
  IF v_role NOT IN ('agent', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT assigned_agent_id INTO v_owner
  FROM public.external_ticket_assignments
  WHERE ticket_id = p_ticket_id;
  RETURN v_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_external_ticket_assignments()
RETURNS TABLE(ticket_id uuid, assigned_agent_id uuid, assigned_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
BEGIN
  IF v_role NOT IN ('agent', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT a.ticket_id, a.assigned_agent_id, a.assigned_at
  FROM public.external_ticket_assignments AS a;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_external_ticket(
  p_ticket_id uuid,
  p_to_agent uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_owner uuid;
BEGIN
  IF v_role NOT IN ('agent', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT assigned_agent_id INTO v_owner
  FROM public.external_ticket_assignments
  WHERE ticket_id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND OR (v_owner <> auth.uid() AND v_role <> 'super_admin') THEN
    RAISE EXCEPTION 'TICKET_NOT_ASSIGNED_TO_CALLER';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE admin_id = p_to_agent) THEN
    RAISE EXCEPTION 'TARGET_ADMIN_NOT_FOUND';
  END IF;

  UPDATE public.external_ticket_assignments
  SET assigned_agent_id = p_to_agent, assigned_at = now()
  WHERE ticket_id = p_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_external_ticket(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_ticket_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_external_ticket_assignments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_external_ticket(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_external_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_ticket_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_external_ticket_assignments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_external_ticket(uuid, uuid) TO authenticated;
