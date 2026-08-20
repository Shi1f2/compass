-- ============================================================
-- Compass — quiz system
-- Tables: quizzes, quiz_questions, quiz_assignments,
--         quiz_answers, job_role_quizzes
--
-- Ordering rule: ALL CREATE TABLE statements come first, in
-- FK-dependency order. Indexes, RLS enables, policies, and
-- triggers follow only after every table exists.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PART 1 — TABLE DEFINITIONS (dependency order)
-- ════════════════════════════════════════════════════════════

-- ─── 1. quizzes ───────────────────────────────────────────────────────────────
-- References: organizations, profiles (both pre-existing)

create table public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text not null default '',
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  constraint quizzes_name_check check (trim(name) <> '')
);

-- ─── 2. quiz_questions ────────────────────────────────────────────────────────
-- References: quizzes

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  kind           text not null check (kind in ('multiple_choice', 'open')),
  prompt         text not null,
  -- multiple_choice: jsonb array of option strings; correct_option is the index
  options        jsonb,
  correct_option integer,
  -- open: reference answer written by supervisor; options/correct_option null
  model_answer   text,
  order_index    integer not null default 0,
  created_at     timestamptz not null default now(),
  constraint quiz_questions_prompt_check check (trim(prompt) <> ''),
  -- multiple_choice must have options + correct_option; model_answer must be null
  constraint quiz_questions_mc_check check (
    kind <> 'multiple_choice'
    or (options is not null and correct_option is not null and model_answer is null)
  ),
  -- open must have neither options nor correct_option
  constraint quiz_questions_open_check check (
    kind <> 'open'
    or (options is null and correct_option is null)
  )
);

-- ─── 3. quiz_assignments ──────────────────────────────────────────────────────
-- References: organizations, quizzes, profiles (×2)

create table public.quiz_assignments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  quiz_id      uuid not null references public.quizzes(id) on delete restrict,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_by  uuid not null references public.profiles(id) on delete restrict,
  status       text not null default 'assigned'
                 check (status in ('assigned', 'in_progress', 'submitted')),
  assigned_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- ─── 4. quiz_answers ─────────────────────────────────────────────────────────
-- References: quiz_assignments, quiz_questions, profiles

create table public.quiz_answers (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.quiz_assignments(id) on delete cascade,
  question_id     uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option integer,
  text_answer     text,
  score           integer check (score >= 0 and score <= 100),
  scored_by       uuid references public.profiles(id) on delete set null,
  scored_at       timestamptz,
  created_at      timestamptz not null default now(),
  constraint quiz_answers_assignment_question_unique
    unique (assignment_id, question_id)
);

-- ─── 5. job_role_quizzes ──────────────────────────────────────────────────────
-- References: job_roles (pre-existing), quizzes

create table public.job_role_quizzes (
  job_role_id uuid not null references public.job_roles(id) on delete cascade,
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  primary key (job_role_id, quiz_id)
);

-- ════════════════════════════════════════════════════════════
-- PART 2 — INDEXES (all tables exist now)
-- ════════════════════════════════════════════════════════════

-- quizzes
create unique index quizzes_org_name_unique
  on public.quizzes (org_id, lower(trim(name)));
create index on public.quizzes (org_id);

-- quiz_questions
create index on public.quiz_questions (quiz_id, order_index);

-- quiz_assignments
create index on public.quiz_assignments (org_id, profile_id);
create index on public.quiz_assignments (quiz_id);
create unique index quiz_assignments_person_quiz_unique
  on public.quiz_assignments (profile_id, quiz_id);

-- quiz_answers
create index on public.quiz_answers (assignment_id);
create index on public.quiz_answers (question_id);

-- job_role_quizzes
create index on public.job_role_quizzes (quiz_id);

-- ════════════════════════════════════════════════════════════
-- PART 3 — ROW LEVEL SECURITY ENABLE
-- ════════════════════════════════════════════════════════════

alter table public.quizzes           enable row level security;
alter table public.quiz_questions    enable row level security;
alter table public.quiz_assignments  enable row level security;
alter table public.quiz_answers      enable row level security;
alter table public.job_role_quizzes  enable row level security;

-- ════════════════════════════════════════════════════════════
-- PART 4 — POLICIES (all tables exist now)
-- ════════════════════════════════════════════════════════════

-- ── quizzes ────────────────────────────────────────────────

create policy "quizzes: supervisor read"
  on public.quizzes for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "quizzes: supervisor insert"
  on public.quizzes for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and created_by = auth.uid()
  );

create policy "quizzes: supervisor update"
  on public.quizzes for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Interns may not read quizzes directly; they access via assignments.
-- The quizzes_delete_guard trigger (below) blocks delete when assignments exist.
create policy "quizzes: supervisor delete"
  on public.quizzes for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ── quiz_questions ─────────────────────────────────────────

create policy "quiz_questions: supervisor read"
  on public.quiz_questions for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
        and q.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

create policy "quiz_questions: supervisor insert"
  on public.quiz_questions for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
        and q.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

create policy "quiz_questions: supervisor update"
  on public.quiz_questions for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
        and q.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

create policy "quiz_questions: supervisor delete"
  on public.quiz_questions for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
        and q.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- Interns read questions only through their own assignments.
-- quiz_assignments now exists, so this forward reference is safe.
create policy "quiz_questions: intern reads assigned"
  on public.quiz_questions for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.quiz_id    = quiz_questions.quiz_id
        and qa.profile_id = auth.uid()
    )
  );

-- ── quiz_assignments ───────────────────────────────────────

create policy "quiz_assignments: supervisor read"
  on public.quiz_assignments for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    and exists (
      select 1 from public.profiles p
      where p.id = quiz_assignments.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

create policy "quiz_assignments: intern reads own"
  on public.quiz_assignments for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and profile_id = auth.uid()
  );

-- Interns update only status; the trigger guards column immutability.
create policy "quiz_assignments: intern updates own status"
  on public.quiz_assignments for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and profile_id = auth.uid()
  )
  with check (
    profile_id = auth.uid()
    and org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ── quiz_answers ───────────────────────────────────────────

create policy "quiz_answers: supervisor read"
  on public.quiz_answers for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1
        from public.quiz_assignments qa
        join public.profiles p on p.id = qa.profile_id
       where qa.id = quiz_answers.assignment_id
         and p.supervisor_id = auth.uid()
    )
  );

create policy "quiz_answers: supervisor scores"
  on public.quiz_answers for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1
        from public.quiz_assignments qa
        join public.profiles p on p.id = qa.profile_id
       where qa.id = quiz_answers.assignment_id
         and p.supervisor_id = auth.uid()
    )
  );

create policy "quiz_answers: intern inserts own"
  on public.quiz_answers for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.id = quiz_answers.assignment_id
        and qa.profile_id = auth.uid()
    )
  );

-- Interns update answers before submission; scoring columns protected by trigger.
create policy "quiz_answers: intern updates own"
  on public.quiz_answers for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.id = quiz_answers.assignment_id
        and qa.profile_id = auth.uid()
        and qa.status <> 'submitted'
    )
  );

create policy "quiz_answers: intern reads own"
  on public.quiz_answers for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern'
    and exists (
      select 1 from public.quiz_assignments qa
      where qa.id = quiz_answers.assignment_id
        and qa.profile_id = auth.uid()
    )
  );

-- ── job_role_quizzes ───────────────────────────────────────

create policy "job_role_quizzes: supervisor read"
  on public.job_role_quizzes for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.job_roles jr
      where jr.id = job_role_quizzes.job_role_id
        and jr.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

create policy "job_role_quizzes: supervisor insert"
  on public.job_role_quizzes for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.job_roles jr
      where jr.id = job_role_quizzes.job_role_id
        and jr.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

create policy "job_role_quizzes: supervisor delete"
  on public.job_role_quizzes for delete
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
    and exists (
      select 1 from public.job_roles jr
      where jr.id = job_role_quizzes.job_role_id
        and jr.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- ════════════════════════════════════════════════════════════
-- PART 5 — TRIGGER FUNCTIONS AND TRIGGERS
-- ════════════════════════════════════════════════════════════

-- ── Trigger: block quiz delete when assignments exist ──────

create or replace function public.quizzes_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_count integer;
begin
  select count(*) into assignment_count
    from public.quiz_assignments
   where quiz_id = OLD.id;

  if assignment_count > 0 then
    raise exception
      'Cannot delete quiz: % assignment(s) already recorded. Archive it instead.',
      assignment_count
      using errcode = 'restrict_violation';
  end if;

  return OLD;
end;
$$;

create trigger quizzes_delete_guard
  before delete on public.quizzes
  for each row
  execute function public.quizzes_delete_guard();

-- ── Trigger: guard intern answer updates (no scoring columns) ─

create or replace function public.quiz_answers_intern_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  if caller_role = 'supervisor' then
    return NEW;
  end if;

  if (
    NEW.score      is distinct from OLD.score      or
    NEW.scored_by  is distinct from OLD.scored_by  or
    NEW.scored_at  is distinct from OLD.scored_at
  ) then
    raise exception
      'quiz_answers: score, scored_by, and scored_at may only be set by a supervisor'
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$;

create trigger quiz_answers_intern_update_guard
  before update on public.quiz_answers
  for each row
  execute function public.quiz_answers_intern_update_guard();

-- ── Trigger: auto-score multiple_choice on INSERT ─────────

create or replace function public.quiz_answers_auto_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_kind           text;
  q_correct_option integer;
begin
  select kind, correct_option
    into q_kind, q_correct_option
    from public.quiz_questions
   where id = NEW.question_id;

  if q_kind = 'multiple_choice' then
    if NEW.selected_option = q_correct_option then
      NEW.score := 100;
    else
      NEW.score := 0;
    end if;
  end if;

  return NEW;
end;
$$;

create trigger quiz_answers_auto_score
  before insert on public.quiz_answers
  for each row
  execute function public.quiz_answers_auto_score();

-- ── Trigger: completed_at + column guard on quiz_assignments ─

create or replace function public.quiz_assignments_completed_at_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'intern' then
    if (
      NEW.org_id      is distinct from OLD.org_id      or
      NEW.quiz_id     is distinct from OLD.quiz_id     or
      NEW.profile_id  is distinct from OLD.profile_id  or
      NEW.assigned_by is distinct from OLD.assigned_by or
      NEW.assigned_at is distinct from OLD.assigned_at
    ) then
      raise exception
        'quiz_assignments: only status may be updated by an intern'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if NEW.status = 'submitted' and OLD.status <> 'submitted' then
    NEW.completed_at := now();
  elsif NEW.status <> 'submitted' and OLD.status = 'submitted' then
    NEW.completed_at := null;
  else
    NEW.completed_at := OLD.completed_at;
  end if;

  return NEW;
end;
$$;

create trigger quiz_assignments_completed_at_guard
  before update on public.quiz_assignments
  for each row
  execute function public.quiz_assignments_completed_at_guard();
