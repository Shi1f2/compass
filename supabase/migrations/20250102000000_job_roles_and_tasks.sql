-- ─── 2. job_roles ─────────────────────────────────────────────────────────────

create table public.job_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  -- Names must be unique within an org, case-insensitively, with no extra whitespace.
  constraint job_roles_name_check check (trim(name) <> '')
);

-- Case-insensitive uniqueness per org.
create unique index job_roles_org_name_unique
  on public.job_roles (org_id, lower(trim(name)));

alter table public.job_roles enable row level security;

-- Everyone in the org reads job_roles.
create policy "job_roles: org members read"
  on public.job_roles
  for select
  using (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Only supervisors insert/update/delete.
create policy "job_roles: supervisor insert"
  on public.job_roles
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "job_roles: supervisor update"
  on public.job_roles
  for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "job_roles: supervisor delete"
  on public.job_roles
  for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ─── 3. task_templates ────────────────────────────────────────────────────────

create table public.task_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  job_role_id uuid not null references public.job_roles(id) on delete cascade,
  title       text not null,
  description text not null default '',
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint task_templates_title_check check (trim(title) <> '')
);

alter table public.task_templates enable row level security;

create policy "task_templates: org members read"
  on public.task_templates
  for select
  using (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "task_templates: supervisor insert"
  on public.task_templates
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "task_templates: supervisor update"
  on public.task_templates
  for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "task_templates: supervisor delete"
  on public.task_templates
  for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ─── 4. tasks ─────────────────────────────────────────────────────────────────

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  -- Nullable: one-off tasks added directly by a supervisor have no template.
  -- SET NULL so deleting a template does not remove tasks already assigned.
  template_id  uuid references public.task_templates(id) on delete set null,
  title        text not null,
  description  text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'done')),
  completed_at timestamptz,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint tasks_title_check check (trim(title) <> '')
);

alter table public.tasks enable row level security;

-- Interns read their own tasks.
create policy "tasks: intern reads own"
  on public.tasks
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and profile_id = auth.uid()
  );

-- Interns may only flip the status of their own tasks.
--
-- Two-layer enforcement:
--   Layer 1 (RLS) — the USING clause gates which rows can be touched at all;
--                   the WITH CHECK clause asserts every immutable column is
--                   unchanged so a crafted PATCH cannot smuggle writes to
--                   title, description, etc. through the anon key.
--   Layer 2 (trigger) — tasks_intern_update_guard fires BEFORE UPDATE and
--                   raises an exception if status is the only column changed
--                   and completed_at is being set by the client rather than
--                   the trigger. The trigger also owns completed_at: it sets
--                   it to now() on done and null on pending, ignoring whatever
--                   the client sends.
--
-- completed_at is NOT referenced in the WITH CHECK because the trigger will
-- overwrite whatever the client sends before the row is committed.
-- The WITH CHECK here intentionally only re-asserts ownership.
-- Column immutability is enforced by the tasks_intern_update_guard trigger
-- (section 5), which fires BEFORE UPDATE and has access to OLD.*. RLS
-- with check does not expose OLD, so the trigger is the right place for
-- the per-column guard.
create policy "tasks: intern updates own status"
  on public.tasks
  for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and profile_id = auth.uid()
  )
  with check (
    profile_id = auth.uid()
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Supervisors read tasks belonging to their own supervisees.
create policy "tasks: supervisor reads supervisee tasks"
  on public.tasks
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = tasks.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

-- Supervisors may insert/update/delete tasks for their own supervisees.
create policy "tasks: supervisor write supervisee tasks"
  on public.tasks
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = tasks.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

create policy "tasks: supervisor update supervisee tasks"
  on public.tasks
  for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = tasks.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

create policy "tasks: supervisor delete supervisee tasks"
  on public.tasks
  for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = tasks.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

-- ─── 5. Trigger: guard intern task updates ───────────────────────────────────
--
-- Fires BEFORE UPDATE on tasks.
-- For non-supervisors (interns) it:
--   a) Rejects the update if any column other than status is different from OLD.
--      (completed_at is allowed to differ because the trigger itself sets it.)
--   b) Sets completed_at to now() when status changes to 'done'.
--   c) Sets completed_at to null  when status changes to 'pending'.
--   d) Returns NULL (aborts) if the role in the JWT is neither 'intern' nor
--      'supervisor', so the guard is vacuously safe against future roles.
--
-- Supervisors bypass the column-restriction check entirely; they may edit
-- any column on a task they own (RLS still gates which rows they can see).

create or replace function public.tasks_intern_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  -- Supervisors: only manage completed_at; skip the column guard.
  if caller_role = 'supervisor' then
    -- Mirror the same completed_at logic so supervisors marking tasks
    -- done/pending stay consistent.
    if NEW.status = 'done' and OLD.status <> 'done' then
      NEW.completed_at := now();
    elsif NEW.status = 'pending' and OLD.status <> 'pending' then
      NEW.completed_at := null;
    end if;
    return NEW;
  end if;

  -- Interns (and any other non-supervisor JWT): enforce column immutability.
  if (
    NEW.org_id       is distinct from OLD.org_id       or
    NEW.profile_id   is distinct from OLD.profile_id   or
    NEW.template_id  is distinct from OLD.template_id  or
    NEW.title        is distinct from OLD.title        or
    NEW.description  is distinct from OLD.description  or
    NEW.order_index  is distinct from OLD.order_index  or
    NEW.created_at   is distinct from OLD.created_at
  ) then
    raise exception
      'tasks: only the status field may be updated by an intern'
      using errcode = 'insufficient_privilege';
  end if;

  -- Manage completed_at based on status transition; ignore client-sent value.
  if NEW.status = 'done' and OLD.status <> 'done' then
    NEW.completed_at := now();
  elsif NEW.status = 'pending' and OLD.status <> 'pending' then
    NEW.completed_at := null;
  else
    -- No status change — restore the existing completed_at unchanged.
    NEW.completed_at := OLD.completed_at;
  end if;

  return NEW;
end;
$$;

create trigger tasks_intern_update_guard
  before update on public.tasks
  for each row
  execute function public.tasks_intern_update_guard();

-- ─── 6. Add job_role_id to profiles ──────────────────────────────────────────

alter table public.profiles
  add column job_role_id uuid references public.job_roles(id) on delete set null;

-- ─── 7. Indexes ───────────────────────────────────────────────────────────────

create index on public.task_templates (org_id, job_role_id, order_index);
create index on public.tasks (org_id, profile_id, order_index);
create index on public.tasks (template_id) where template_id is not null;
create index on public.profiles (job_role_id) where job_role_id is not null;
