# Compass

**Find your bearings.** Compass is an embedded onboarding assistant that already knows an employee's systems, their role, and their first ninety days — mentor, tutor and compliance record in one.

Compass is a Next.js App Router application backed by Supabase. Authentication is invite-only OTP email. Two roles — **supervisor** and **intern** — are enforced by JWT `app_metadata` and Postgres RLS. The application is also used for demo presentations; onboarding content (topics, quiz) is seeded from static TypeScript files until the knowledge backend is wired.

---

## Running the app

```bash
npm install
npm run dev       # development server at http://localhost:3000
npm run build     # production build
npm run lint      # ESLint
```

Requires Node 18 or later.

---

## Stack

| | |
|---|---|
| Framework | Next.js 14.2.15, App Router |
| Language | TypeScript 5, strict mode |
| Styling | Tailwind CSS 3.4 + PostCSS + autoprefixer |
| Icons | lucide-react 0.454 |
| Auth / DB | Supabase (PostgreSQL + Auth + RLS) |
| Email | Resend (Supabase custom SMTP) |

---

## Two roles

Sign-in is a two-step OTP flow: email → six-digit code. The system is invite-only — only provisioned accounts receive a code. Roles are read from the account's JWT `app_metadata`; there is no role chooser at sign-in.

### New starter

The new starter sees three tabs:

**Mentor** — A question-and-answer assistant. Type any question into the sidebar; Compass matches it to the closest onboarding topic and presents the answer as a swipeable card carousel. Each card steps through the answer sentence by sentence, with a progress bar. The final card collapses into detail rows and offers a rephrase button (which swaps in the alternate wording) and a link to the report panel.

**Tutor** — The quiz view. Days are listed in the left panel and can be dragged to reorder. Each day holds a set of multiple-choice or written questions. Results, scores and acknowledgements are all hardcoded seed data — no scoring logic runs in the browser.

**Profile** — Identity card, employment details, the proportional programme strip (clicking a segment jumps to that topic in the Mentor tab), gamification progress and connected systems.

### Supervisor

The supervisor sees three tabs:

**Supervisor** — A roster of eight new starters. A search box filters the list. Each card shows a name, role, setup completion percentage and knowledge average. Tapping a card opens a detail view with two sub-tabs:

- *Checklist* — The starter's setup tasks, grouped waiting → not started → done.
- *Knowledge* — The full Tutor view for that starter: days on the left, questions on the right. Dragging reorders days; locked days (nothing attempted) cannot be opened.

**Profile** — The supervisor's own identity card and a summary of the roster.

---

## The two-dimensional model

Each starter in the supervisor roster has two independent scores:

- **Setup completion** — how far through the onboarding checklist they are
- **Knowledge average** — the mean quiz score across attempted questions

These two dimensions are deliberately designed to disagree. Daniel Iqbal's card, for example, shows a full setup bar next to a failing knowledge average: his tasks are ticked off but the quiz results are poor. Ella Whitmore has no attempted questions at all, so her days read as locked. This asymmetry is the demo's central point: task completion and genuine understanding are different things, and Compass tracks both.

---

## Report formats

The report panel (opened from the closing card in the Mentor tab) offers two output formats:

**Manager summary** — One sheet per six topics. Each sheet has a two-column layout: a 2×3 picture grid on the left (source-system illustrations + answers) and a detail column on the right (where each topic lives in the system, source, any note). The first sheet adds a policy acknowledgements panel. A specification strip runs across the foot of every sheet.

**Compliance evidence pack** — One sheet per four questions. Each cell shows the question, the illustration, the result (pass/fail or percentage for written questions), and the attempt timestamp. The detail column shows the explanation and the acknowledgement sentence.

Both formats support A4 (210×297 mm) and US Letter (215.9×279.4 mm). Choosing "Export PDF" calls the browser's native print dialog; choose "Save as PDF" there. Each sheet is drawn 1 mm shorter than its nominal height to prevent sub-pixel rounding from inserting a blank page between sheets.

Illustrations can be toggled off; without them, more items fit per sheet.

---

## Data model

All types are declared in [`lib/types.ts`](lib/types.ts). All seed data is in [`lib/data.ts`](lib/data.ts) — two fully worked profiles (Priya Shah, a permanent employee in Platform Engineering, and Marcus Webb, a Restricted-tier QA contractor) each with ten Mentor topics and twenty Tutor questions across five onboarding days.

The supervisor roster is in [`lib/supervisorData.ts`](lib/supervisorData.ts).

Nothing in this data is ever computed from the other parts at save time. Derived figures (completion percentages, average scores, estimated sheet counts) are computed at render time from the underlying arrays.

---

## Design system

The palette is defined as CSS custom properties in [`app/globals.css`](app/globals.css) and exposed as Tailwind colour names in [`tailwind.config.js`](tailwind.config.js). No component writes a literal colour value; every colour resolves through `var(--color-*)`. The deliberate exception is the Brightfield mock interface inside the software frame, which uses an off-palette palette because it represents a separate fictional product.

Shape primitives (`.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.field`, `.pill`, `.row-item`, `.track`, `.track-fill`, `.section-label`) are defined as `@layer components` in the globals stylesheet. Nothing re-implements them locally.

---

## Project structure

```
app/
  globals.css       palette, primitives, animations, print styles
  layout.tsx        root layout, Poppins link, reduced-motion script
  page.tsx          three-phase machine: login → processing → console

components/
  Wordmark.tsx      Mark, Wordmark, Lockup
  FrameImage.tsx    SoftwareFrame with detection box overlay
  LoginScreen.tsx   two-step sign-in
  ProcessingScreen.tsx  fake connection sequence
  tracedIllustration.ts  user-supplied SVG paths (do not edit)
  console/          ConsoleShell and all tab components
  screens/          SoftwareFrame SVG (8 views of the Brightfield mock)
  pdf/              PdfPreview print layout

lib/
  types.ts          all type declarations
  data.ts           seed data: two profiles, topics, quiz
  supervisorData.ts roster, question bank, checklist builders
  consoleState.ts   reducer and state for the signed-in shell
  quizGroup.ts      groupByDay, firstUnanswered, scoring helpers
  format.ts         dayLabel, phaseLabel, UI strings
  splitAnswer.ts    sentence-step answer splitting

public/
  clean.png         loading screen image (user-supplied, do not edit)
```

---

## Operations

### Running the migration

Apply the schema once to your Supabase project. Either:

```bash
# With the Supabase CLI:
supabase db push

# Or paste supabase/migrations/20250101000000_initial_schema.sql
# directly into the Supabase SQL editor.
```

### Configuring Resend SMTP

1. In the Resend dashboard, create an API key with **Full access**.
2. In the Supabase dashboard, go to **Project Settings → Auth → SMTP**.
3. Enable custom SMTP and set:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender name and address: your verified sending domain
4. Set **OTP expiry** to `600` seconds (10 minutes) under **Authentication → Providers → Email**.
5. Optionally customise the OTP email template under **Authentication → Email Templates → Magic Link / OTP**.

### Provisioning the first organisation

Run the provision script once per organisation. It creates the organisation row, the first supervisor's auth user, and sends them an invite email.

```bash
npm run provision -- \
  --org  "Acme Corp" \
  --domain "acme.com" \
  --email "alice@acme.com" \
  --name  "Alice Smith"
```

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` to be set in `.env.local`.

The supervisor can then sign in at `/login` with their company email and the OTP sent to their inbox.

### Inviting interns

Once a supervisor is signed in, they use the **Invite new starter** button in the supervisor console. The server action verifies the caller's role from their JWT, checks that the invited address matches the organisation domain, creates the auth user, writes the profile and invitation rows, and sends a magic-link email.
