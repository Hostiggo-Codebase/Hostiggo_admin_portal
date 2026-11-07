-- Run on the primary admin portal Supabase project.
-- Let an agent claim any unassigned, non-terminal ticket, including legacy
-- ACTIVE/ASSIGNED/WAITING_ON_USER rows created before owner tracking worked.
CREATE OR REPLACE FUNCTION take_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_status text;
  v_assigned_agent_id uuid;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role NOT IN ('agent', 'super_admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT status, assigned_agent_id
    INTO v_status, v_assigned_agent_id
  FROM support_tickets
  WHERE ticket_id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF v_assigned_agent_id = auth.uid() THEN
    RETURN;
  END IF;

  IF v_assigned_agent_id IS NOT NULL THEN
    RAISE EXCEPTION 'TICKET_ALREADY_TAKEN';
  END IF;

  IF v_status IN ('RESOLVED', 'CLOSED') THEN
    RAISE EXCEPTION 'TICKET_COMPLETED';
  END IF;

  UPDATE support_tickets
  SET assigned_agent_id = auth.uid(),
      assigned_at = COALESCE(assigned_at, now()),
      status = CASE WHEN v_status = 'QUEUED' THEN 'ACTIVE' ELSE v_status END
  WHERE ticket_id = p_ticket_id;
END;
$$;
