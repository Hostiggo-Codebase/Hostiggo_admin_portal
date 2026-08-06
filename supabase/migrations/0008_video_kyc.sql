-- =============================================================================
-- Migration 0008: Video Submissions & KYC
-- =============================================================================

-- ---------------------------------------------------------------------------
-- video_submissions
-- ---------------------------------------------------------------------------
create table video_submissions (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references support_tickets(ticket_id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  storage_path text not null,
  file_name    text not null,
  file_size    bigint,
  mime_type    text,
  status       text not null default 'pending'
                 check (status in ('pending', 'reviewed')),
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_video_submissions_ticket_id on video_submissions (ticket_id);
create index idx_video_submissions_user_id   on video_submissions (user_id);

-- ---------------------------------------------------------------------------
-- kyc_submissions
-- ---------------------------------------------------------------------------
create table kyc_submissions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id),
  document_type        text not null
                         check (document_type in ('passport','driving_license','national_id','other')),
  document_front_path  text not null,
  document_back_path   text,
  selfie_path          text,
  status               text not null default 'pending'
                         check (status in ('pending','approved','rejected','resubmit_required')),
  rejection_reason     text,
  reviewed_by          uuid references auth.users(id),
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

create trigger trg_kyc_submissions_updated_at
  before update on kyc_submissions
  for each row execute function touch_updated_at();

create index idx_kyc_submissions_user_id on kyc_submissions (user_id);
create index idx_kyc_submissions_pending  on kyc_submissions (status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- user_kyc_status  (one row per user, single source of truth)
-- ---------------------------------------------------------------------------
create table user_kyc_status (
  user_id              uuid primary key references auth.users(id),
  is_verified          boolean not null default false,
  latest_submission_id uuid references kyc_submissions(id),
  last_verified_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

create trigger trg_user_kyc_status_updated_at
  before update on user_kyc_status
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ticket-videos', 'ticket-videos', false, 104857600,
   array['video/mp4','video/quicktime','video/webm','video/x-msvideo','video/x-matroska']),
  ('kyc-documents', 'kyc-documents', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS — ticket-videos
-- ---------------------------------------------------------------------------
create policy "ticket-videos: user upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-videos'
    and (storage.foldername(name))[1] in (
      select ticket_id::text from support_tickets where user_id = auth.uid()
    )
  );

create policy "ticket-videos: user read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-videos'
    and (storage.foldername(name))[1] in (
      select ticket_id::text from support_tickets where user_id = auth.uid()
    )
  );

create policy "ticket-videos: admin read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-videos'
    and exists (select 1 from admin_users where admin_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage RLS — kyc-documents
-- ---------------------------------------------------------------------------
create policy "kyc-documents: user upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc-documents: user read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc-documents: super admin read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and exists (
      select 1 from admin_users
      where admin_id = auth.uid() and role = 'SUPER_ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS — video_submissions
-- ---------------------------------------------------------------------------
alter table video_submissions enable row level security;

create policy "video_submissions: user sees own"
  on video_submissions for select to authenticated
  using (user_id = auth.uid());

create policy "video_submissions: user inserts own"
  on video_submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from support_tickets
      where ticket_id = video_submissions.ticket_id and user_id = auth.uid()
    )
  );

create policy "video_submissions: agent sees assigned"
  on video_submissions for select to authenticated
  using (
    exists (
      select 1 from support_tickets t
      join admin_users a on a.admin_id = auth.uid()
      where t.ticket_id = video_submissions.ticket_id
        and (t.assigned_agent_id = auth.uid() or a.role = 'SUPER_ADMIN')
    )
  );

create policy "video_submissions: admin marks reviewed"
  on video_submissions for update to authenticated
  using (exists (select 1 from admin_users where admin_id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS — kyc_submissions
-- ---------------------------------------------------------------------------
alter table kyc_submissions enable row level security;

create policy "kyc_submissions: user sees own"
  on kyc_submissions for select to authenticated
  using (user_id = auth.uid());

create policy "kyc_submissions: user inserts own"
  on kyc_submissions for insert to authenticated
  with check (user_id = auth.uid());

create policy "kyc_submissions: super admin sees all"
  on kyc_submissions for select to authenticated
  using (
    exists (select 1 from admin_users where admin_id = auth.uid() and role = 'SUPER_ADMIN')
  );

create policy "kyc_submissions: super admin updates"
  on kyc_submissions for update to authenticated
  using (
    exists (select 1 from admin_users where admin_id = auth.uid() and role = 'SUPER_ADMIN')
  );

-- ---------------------------------------------------------------------------
-- RLS — user_kyc_status
-- ---------------------------------------------------------------------------
alter table user_kyc_status enable row level security;

create policy "user_kyc_status: user sees own"
  on user_kyc_status for select to authenticated
  using (user_id = auth.uid());

create policy "user_kyc_status: super admin sees all"
  on user_kyc_status for select to authenticated
  using (
    exists (select 1 from admin_users where admin_id = auth.uid() and role = 'SUPER_ADMIN')
  );

-- ---------------------------------------------------------------------------
-- RPC: add_video_submission
-- Records a video after the client has uploaded to storage.
-- ---------------------------------------------------------------------------
create or replace function add_video_submission(
  p_ticket_id    uuid,
  p_storage_path text,
  p_file_name    text,
  p_file_size    bigint,
  p_mime_type    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from support_tickets
    where ticket_id = p_ticket_id and user_id = auth.uid()
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  insert into video_submissions (ticket_id, user_id, storage_path, file_name, file_size, mime_type)
  values (p_ticket_id, auth.uid(), p_storage_path, p_file_name, p_file_size, p_mime_type)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: submit_kyc
-- User submits KYC; any existing pending submission is superseded.
-- ---------------------------------------------------------------------------
create or replace function submit_kyc(
  p_document_type        text,
  p_document_front_path  text,
  p_document_back_path   text default null,
  p_selfie_path          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
begin
  if exists (select 1 from admin_users where admin_id = auth.uid()) then
    raise exception 'ADMIN_CANNOT_SUBMIT_KYC';
  end if;

  -- Supersede prior pending submission
  update kyc_submissions
  set status = 'rejected', rejection_reason = 'Superseded by new submission'
  where user_id = auth.uid() and status = 'pending';

  insert into kyc_submissions (
    user_id, document_type, document_front_path, document_back_path, selfie_path
  ) values (
    auth.uid(), p_document_type, p_document_front_path, p_document_back_path, p_selfie_path
  )
  returning id into v_submission_id;

  insert into user_kyc_status (user_id, is_verified, latest_submission_id)
  values (auth.uid(), false, v_submission_id)
  on conflict (user_id) do update
    set latest_submission_id = v_submission_id,
        is_verified = false,
        updated_at = now();

  return v_submission_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: review_kyc  (Super Admin only)
-- ---------------------------------------------------------------------------
create or replace function review_kyc(
  p_submission_id    uuid,
  p_status           text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not exists (
    select 1 from admin_users where admin_id = auth.uid() and role = 'SUPER_ADMIN'
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_status not in ('approved','rejected','resubmit_required') then
    raise exception 'INVALID_STATUS';
  end if;

  select user_id into v_user_id from kyc_submissions where id = p_submission_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  update kyc_submissions
  set status           = p_status,
      rejection_reason = p_rejection_reason,
      reviewed_by      = auth.uid(),
      reviewed_at      = now()
  where id = p_submission_id;

  update user_kyc_status
  set is_verified      = (p_status = 'approved'),
      last_verified_at = case when p_status = 'approved' then now() else null end,
      updated_at       = now()
  where user_id = v_user_id;

  insert into audit_logs (admin_id, action, new_value)
  values (
    auth.uid(),
    'KYC_' || upper(p_status),
    jsonb_build_object(
      'submission_id',    p_submission_id,
      'user_id',          v_user_id,
      'rejection_reason', p_rejection_reason
    )
  );
end $$;
