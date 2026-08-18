# Compass

**Find your bearings.** Compass is an embedded onboarding assistant that already knows an employee's systems, their role, and their first ninety days — mentor, tutor and compliance record in one.

This repository is a **front-end-only demo**. There is no backend, no API routes, no server actions, no database, no ORM, and no browser storage of any kind. Every piece of data is hardcoded in TypeScript files in `lib/`. All state lives in React memory and disappears when the page is refreshed. The application builds and runs with no network access at all; the font fallback stack covers the case where Google Fonts is unreachable.

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

No other runtime dependencies. No UI kit, no state library, no data-fetching library.

---

## Two roles

Sign-in is a two-step flow: email → six-character code. The email drives the persona shown in the app (name and company are derived from it). The code is accepted regardless of what you type. A checkbox on the code step switches between the two roles.

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

## Front-end only — explicit statement

This application has no backend of any kind. It makes no network requests, calls no APIs, writes to no databases, and persists nothing in the browser. Refreshing the page resets the app to the sign-in screen. All data is hardcoded in `lib/data.ts` and `lib/supervisorData.ts`. This is intentional: the demo is designed to run fully offline, in air-gapped environments, and in browser demos where network access cannot be guaranteed.
