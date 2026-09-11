-- =============================================================================
-- Migration 0010: Sync admin_users.role → auth.users.app_metadata
--
-- Why: The middleware and all RLS policies read `app_metadata.role` from the
-- JWT, but nothing ever wrote to auth.users.raw_app_meta_data when a user was
-- inserted into admin_users.  This caused admin logins to redirect to the user
-- portal instead of the admin panel.
--
-- Fix:
--   1. Trigger on admin_users INSERT/UPDATE → sets the JWT role.
--   2. Trigger on auth.users INSERT → gives every new user a default 'user' role
--      so the `app_metadata.role` key is always present in the JWT.
-- =============================================================================

-- 1. Sync admin role when a row is inserted/updated in admin_users
create or replace function sync_admin_role_to_auth()
returns trigger language plpgsql security definer as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'role',
      case new.role
        when 'SUPER_ADMIN' then 'super_admin'
        when 'ADMIN'       then 'agent'
        else 'user'
      end
    )
  where id = new.admin_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_admin_role on admin_users;
create trigger trg_sync_admin_role
  after insert or update of role on admin_users
  for each row execute function sync_admin_role_to_auth();


-- 2. Set a default 'user' role for every new signup (before insert so the
--    JWT contains the role from the very first session)
create or replace function set_default_user_role()
returns trigger language plpgsql security definer as $$
begin
  if (new.raw_app_meta_data ->> 'role') is null then
    new.raw_app_meta_data :=
      coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"user"}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_default_user_role on auth.users;
create trigger trg_default_user_role
  before insert on auth.users
  for each row execute function set_default_user_role();
