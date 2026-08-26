-- ============================================================
-- Compass — user questions log + AI categorisation
--
-- Captures every question a user asks Compass, together with
-- the AI-assigned category (e.g. "Sign-up issues") and the
-- source topic/product slug the answer came from.
--
-- Supervisors read all questions from their own org so they
-- can view the aggregated heatmap.  Interns (and the service
-- role) insert rows — no client-side read for interns.
-- ============================================================

create table public.user_questions (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations on delete cascade,
  user_id       uuid        not null references public.profiles(id)  on delete cascade,
  question      text        not null,
  -- AI-assigned short key, e.g. "signup_issues", "laptop_setup"
  category      text        not null default 'uncategorised',
  -- Human-readable label, e.g. "Sign-up issues"
  category_label text       not null default 'Uncategorised',
  -- The knowledge-topic slug that answered the question, e.g. "youtube"
  source_topic  text,
  asked_at      timestamptz not null default now()
);

alter table public.user_questions enable row level security;

-- Supervisors read all questions from their own org.
create policy "user_questions: supervisor reads own org"
  on public.user_questions
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Interns insert their own rows only.
create policy "user_questions: intern inserts own"
  on public.user_questions
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and user_id  = auth.uid()
    and org_id   = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index on public.user_questions (org_id);
create index on public.user_questions (user_id);
create index on public.user_questions (category);
create index on public.user_questions (asked_at desc);
