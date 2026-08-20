-- ============================================================
-- Compass — initial schema
-- Run once against your Supabase project:
--   supabase db push
-- or paste directly into the SQL editor.
-- ============================================================

-- ─── Organizations ────────────────────────────────────────────────────────────

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  domain     text not null unique,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Any authenticated user may read their own org.
-- org_id is read from the JWT's app_metadata — no extra query needed.
create policy "org: members read own org"
  on public.organizations
  for select
  using (
    id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ─── Profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  org_id        uuid not null references public.organizations on delete cascade,
  role          text not null check (role in ('supervisor', 'intern')),
  full_name     text not null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Supervisors read all profiles in their org where supervisor_id is their own id.
create policy "profiles: supervisor reads own reports"
  on public.profiles
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and (
      supervisor_id = auth.uid()
      -- supervisor can also read their own profile
      or id = auth.uid()
    )
  );

-- Interns read only their own row.
create policy "profiles: intern reads own row"
  on public.profiles
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and id = auth.uid()
  );

-- Service role (used by provision script and invite action) can insert/update.
-- No client-side write policy is needed; all writes go through server actions.

-- ─── Invitations ──────────────────────────────────────────────────────────────

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations on delete cascade,
  email      text not null,
  role       text not null check (role in ('supervisor', 'intern')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

-- Only supervisors may read invitations belonging to their org.
create policy "invitations: supervisor reads own org"
  on public.invitations
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Only supervisors may insert invitations, and only for their own org.
create policy "invitations: supervisor inserts"
  on public.invitations
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and invited_by = auth.uid()
  );

-- ─── Auth helper: OTP settings note ──────────────────────────────────────────
-- OTP expiry and email templates are configured in the Supabase dashboard
-- under Authentication → Email Templates and Authentication → Providers → Email.
-- Set "OTP expiry" to 600 seconds (10 minutes).
-- Supabase Auth SMTP (Resend) is configured under Project Settings → Auth → SMTP.

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index on public.profiles (org_id);
create index on public.profiles (supervisor_id);
create index on public.invitations (org_id);
create index on public.invitations (email);
