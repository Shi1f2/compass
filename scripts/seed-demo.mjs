#!/usr/bin/env node
/**
 * scripts/seed-demo.mjs
 * Seeds up to forty-five fake new starters across up to three real supervisors
 * so the demo supervisor dashboards look alive.
 *
 * Usage (seed — two teams):
 *   npm run seed-demo -- --arda "arda@example.com" --arman "arman@example.com"
 *
 * Usage (seed — three teams):
 *   npm run seed-demo -- --arda "arda@example.com" --arman "arman@example.com" --benjamin "benjamin@example.com"
 *
 * Usage (teardown — deletes everything created by this script):
 *   npm run seed-demo -- --arda "arda@example.com" --arman "arman@example.com" --teardown
 *
 * Flags:
 *   --arda    <email>   Email of the supervisor who owns the Development team
 *   --arman   <email>   Email of the supervisor who owns the first Project Management team
 *   --benjamin <email>   (Optional) Email of the supervisor who owns the second Project
 *                       Management team. When omitted only the two existing teams are seeded.
 *   --teardown          Delete all fake starters (matched by the FAKE_DOMAIN
 *                       constant below) and everything they own, then exit.
 *
 * What it does (seed):
 *  1. Looks up all provided supervisors; aborts if any is missing, wrong role,
 *     or not in the same organisation as the others.
 *  2. Ensures a "Development" and a "Project Management" job role exist for
 *     the org (idempotent).
 *  3. Ensures task templates exist for each role (idempotent).
 *  4. Ensures a quiz library exists for each role (idempotent). The third team
 *     reuses the Project Management role, its templates, and its quizzes — no
 *     duplicates are created.
 *  5. Creates 15 fake interns per supervisor (skips any whose email already
 *     exists in auth.users — safe to re-run).
 *  6. For each new intern: copies tasks from their role's templates, marks
 *     some done with backdated timestamps, assigns the role's quizzes, and
 *     places each person in one of four completion buckets.
 *  7. Writes scattered user_questions rows so the heatmap is not blank.
 *  8. Prints a summary.
 *
 * What teardown does:
 *  Deletes every auth user whose email ends with FAKE_DOMAIN, and cascades
 *  through profiles → tasks, quiz_assignments → quiz_answers, user_questions.
 *  Quizzes, job roles and task templates are left alone (they belong to the org,
 *  not to individual starters).  Prints a summary of what was removed.
 *
 * Idempotency:
 *  Running the seed a second time prints "already exists — skipping" for every
 *  person and performs no writes.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'

// ─── Load .env.local ──────────────────────────────────────────────────────────

try {
  const { config } = await import('dotenv')
  config({ path: '.env.local' })
} catch {
  // dotenv not installed — rely on externally-set env vars
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** All fake starter emails end with this domain. Used to scope teardown. */
const FAKE_DOMAIN = '@demo-seed.internal'

// ─── Parse arguments ──────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    arda:      { type: 'string' },
    arman:     { type: 'string' },
    benjamin:  { type: 'string' },
    teardown:  { type: 'boolean', default: false },
  },
})

if (!values.arda || !values.arman) {
  console.error([
    'Error: --arda and --arman are required.',
    '',
    'Seed (two teams):   npm run seed-demo -- --arda <email> --arman <email>',
    'Seed (three teams): npm run seed-demo -- --arda <email> --arman <email> --benjamin <email>',
    'Teardown:           npm run seed-demo -- --arda <email> --arman <email> --teardown',
  ].join('\n'))
  process.exit(1)
}

// ─── Admin client ─────────────────────────────────────────────────────────────

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !secret) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function die(msg, err) {
  console.error(`\n✗ ${msg}`)
  if (err) console.error('  ', err.message ?? err)
  process.exit(1)
}

function log(msg) { console.log(`  ${msg}`) }
function section(msg) { console.log(`\n── ${msg}`) }

/**
 * Returns a date string (ISO 8601) randomly distributed over the last
 * `maxDaysAgo` days, as old as `minDaysAgo` days ago.
 */
function randomPastDate(minDaysAgo = 1, maxDaysAgo = 120) {
  const offset = minDaysAgo + Math.floor(Math.random() * (maxDaysAgo - minDaysAgo))
  const d = new Date(Date.now() - offset * 86_400_000)
  return d.toISOString()
}

/** Seeded pseudorandom number in [0, 1) based on a string seed. */
function seededFloat(seed) {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return (h >>> 0) / 0xffffffff
}

// ─── Fake people data ─────────────────────────────────────────────────────────

const DEV_PEOPLE = [
  { first: 'Kieran',    last: 'Walsh',      title: 'Software Engineer',          start: -85 },
  { first: 'Mei',       last: 'Tanaka',     title: 'Frontend Developer',         start: -72 },
  { first: 'Tobias',    last: 'Henriksen',  title: 'Backend Engineer',           start: -61 },
  { first: 'Layla',     last: 'Okafor',     title: 'Full Stack Developer',       start: -55 },
  { first: 'Reuben',    last: 'Clarke',     title: 'Software Engineer',          start: -48 },
  { first: 'Sasha',     last: 'Petrov',     title: 'DevOps Engineer',            start: -41 },
  { first: 'Imogen',    last: 'Hartley',    title: 'Frontend Developer',         start: -37 },
  { first: 'Dawit',     last: 'Bekele',     title: 'Backend Engineer',           start: -33 },
  { first: 'Fiona',     last: 'MacGregor',  title: 'Full Stack Developer',       start: -28 },
  { first: 'Noel',      last: 'Dupont',     title: 'Site Reliability Engineer',  start: -24 },
  { first: 'Priya',     last: 'Venkatesh',  title: 'Software Engineer',          start: -20 },
  { first: 'Callum',    last: 'Stewart',    title: 'Frontend Developer',         start: -17 },
  { first: 'Zara',      last: 'Hussain',    title: 'Backend Engineer',           start: -14 },
  { first: 'Luca',      last: 'Ferretti',   title: 'DevOps Engineer',            start: -10 },
  { first: 'Amara',     last: 'Diallo',     title: 'Software Engineer',          start: -7  },
]

const PM_PEOPLE = [
  { first: 'Helen',     last: 'Forsythe',   title: 'Project Manager',            start: -90 },
  { first: 'Jerome',    last: 'Achebe',     title: 'Programme Coordinator',      start: -78 },
  { first: 'Katja',     last: 'Bauer',      title: 'Project Manager',            start: -67 },
  { first: 'Samuel',    last: 'Osei',       title: 'Delivery Manager',           start: -58 },
  { first: 'Brigitte',  last: 'Laurent',    title: 'Project Coordinator',        start: -50 },
  { first: 'Owen',      last: 'Griffiths',  title: 'Project Manager',            start: -44 },
  { first: 'Yasmin',    last: 'Fadel',      title: 'Programme Manager',          start: -38 },
  { first: 'Tariq',     last: 'Mansour',    title: 'Project Coordinator',        start: -32 },
  { first: 'Elena',     last: 'Sorokina',   title: 'Delivery Manager',           start: -27 },
  { first: 'Conrad',    last: 'Brandt',     title: 'Project Manager',            start: -22 },
  { first: 'Naomi',     last: 'Sekibo',     title: 'Programme Coordinator',      start: -18 },
  { first: 'Felipe',    last: 'Reyes',      title: 'Project Manager',            start: -15 },
  { first: 'Astrid',    last: 'Lindqvist',  title: 'Delivery Manager',           start: -11 },
  { first: 'Kofi',      last: 'Asante',     title: 'Project Coordinator',        start: -8  },
  { first: 'Mia',       last: 'Johansson',  title: 'Project Manager',            start: -5  },
]

const PM2_PEOPLE = [
  { first: 'Darius',    last: 'Navarro',    title: 'Project Manager',            start: -88 },
  { first: 'Ingrid',    last: 'Svensson',   title: 'Programme Coordinator',      start: -76 },
  { first: 'Kwame',     last: 'Mensah',     title: 'Delivery Manager',           start: -64 },
  { first: 'Valentina', last: 'Ricci',      title: 'Project Coordinator',        start: -56 },
  { first: 'Marcus',    last: 'Okwu',       title: 'Project Manager',            start: -47 },
  { first: 'Sofie',     last: 'Andersen',   title: 'Programme Manager',          start: -42 },
  { first: 'Rafael',    last: 'Cardoso',    title: 'Delivery Manager',           start: -36 },
  { first: 'Anneke',    last: 'Visser',     title: 'Project Coordinator',        start: -30 },
  { first: 'Benson',    last: 'Kimani',     title: 'Project Manager',            start: -25 },
  { first: 'Lena',      last: 'Hoffmann',   title: 'Programme Coordinator',      start: -21 },
  { first: 'Tomás',     last: 'Varela',     title: 'Delivery Manager',           start: -16 },
  { first: 'Chiara',    last: 'Gallo',      title: 'Project Manager',            start: -13 },
  { first: 'Reuben',    last: 'Nakamura',   title: 'Programme Manager',          start: -9  },
  { first: 'Fatou',     last: 'Camara',     title: 'Project Coordinator',        start: -6  },
  { first: 'Aleksei',   last: 'Volkov',     title: 'Project Manager',            start: -3  },
]

function makeEmail(first, last) {
  // NFD decompose so accents separate from their base letters, strip the
  // combining marks (U+0300–U+036F), then drop anything that is not a plain
  // lowercase letter or digit.  Names that contain only plain ASCII letters
  // produce exactly the same address as before.
  const norm = s => s.toLowerCase()
                     .normalize('NFD')
                     .replace(/[\u0300-\u036f]/g, '')
                     .replace(/[^a-z0-9]/g, '')
  return `${norm(first)}.${norm(last)}${FAKE_DOMAIN}`
}

function makeStartDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}

// ─── Task templates ───────────────────────────────────────────────────────────

const DEV_TASKS = [
  'Set up local development environment',
  'Complete laptop and tooling checklist',
  'Request access to source-control repositories',
  'Attend engineering onboarding session',
  'Read architecture decision records',
  'Complete security awareness training',
  'Set up VPN and remote-access credentials',
  'Shadow a sprint planning meeting',
  'Submit first pull request (hello world)',
  'Complete code review guidelines module',
]

const PM_TASKS = [
  'Complete company induction and HR paperwork',
  'Set up project management tooling accounts',
  'Read programme governance framework',
  'Shadow a project status meeting',
  'Complete risk management training module',
  'Set up stakeholder directory access',
  'Review active project portfolio',
  'Complete data protection and compliance training',
  'Write first project status report',
  'Attend stakeholder introduction meetings',
]

// ─── Quiz library ─────────────────────────────────────────────────────────────

const DEV_QUIZZES = [
  {
    name:        'Engineering Tools & Processes',
    description: 'Covers the team\'s development workflow, branching strategy, and CI/CD pipeline.',
    questions: [
      {
        prompt: 'What is the primary purpose of a feature branch in the team\'s Git workflow?',
        options: [
          'To isolate work in progress from the main codebase until it is reviewed and approved',
          'To store a permanent archive of released versions',
          'To run automated tests against the production database',
          'To synchronise changes directly into the live environment',
        ],
        correct: 0,
      },
      {
        prompt: 'Which command correctly stages all modified files for a commit?',
        options: [
          'git commit -a',
          'git add .',
          'git push origin main',
          'git merge --staged',
        ],
        correct: 1,
      },
      {
        prompt: 'A pull request is blocked by a failing CI check. What should you do first?',
        options: [
          'Force-push to bypass the check',
          'Merge anyway and fix it in a follow-up commit',
          'Read the build log to identify the failure before making any change',
          'Ask a senior engineer to approve it without reading the log',
        ],
        correct: 2,
      },
      {
        prompt: 'What does a 409 Conflict HTTP status code indicate?',
        options: [
          'The server cannot find the requested resource',
          'The request conflicts with the current state of the resource',
          'The client is not authenticated',
          'The server encountered an unexpected condition',
        ],
        correct: 1,
      },
      {
        prompt: 'Which environment variable naming convention is enforced in this codebase?',
        options: [
          'camelCase with a leading dollar sign',
          'ALL_CAPS_UNDERSCORE_SEPARATED',
          'PascalCase with a NEXT_ prefix',
          'lowercase with hyphens',
        ],
        correct: 1,
      },
      {
        prompt: 'How long before it expires is an OTP code considered valid in this system?',
        options: [
          '30 seconds',
          '5 minutes',
          '10 minutes',
          '1 hour',
        ],
        correct: 2,
      },
      {
        prompt: 'What is the correct way to introduce a breaking change to a shared API?',
        options: [
          'Rename the endpoint immediately and update all callers in the same commit',
          'Version the endpoint (e.g. /v2/) and deprecate the old version with a sunset date',
          'Delete the old endpoint without notice to force callers to update quickly',
          'Keep the old endpoint and the new one permanently in parallel with no deprecation',
        ],
        correct: 1,
      },
      {
        prompt: 'What does RLS stand for in the context of this project\'s database?',
        options: [
          'Remote Login Service',
          'Row Level Security',
          'Relational Linking Schema',
          'Role Loading Strategy',
        ],
        correct: 1,
      },
    ],
  },
  {
    name:        'Security & Access Control',
    description: 'Covers authentication, authorisation, and safe handling of credentials.',
    questions: [
      {
        prompt: 'Where should API keys and secrets be stored in a Next.js project?',
        options: [
          'Directly in the source code for convenience',
          'In a .env.local file, excluded from version control via .gitignore',
          'In a public folder so they load quickly',
          'In a JSON file committed alongside the component that uses them',
        ],
        correct: 1,
      },
      {
        prompt: 'A colleague sends you a database password over chat to help you debug. What should you do?',
        options: [
          'Use it quickly and then ask them to rotate it',
          'Store it in your notes app for future reference',
          'Decline, ask for the password to be rotated, and use a proper secrets store',
          'Share it with the wider team so others can also debug',
        ],
        correct: 2,
      },
      {
        prompt: 'What is the purpose of the service-role key in Supabase?',
        options: [
          'It is used by end users to authenticate their sessions',
          'It bypasses Row Level Security and should only be used in trusted server contexts',
          'It limits callers to read-only access across all tables',
          'It is interchangeable with the anon key but has a longer expiry',
        ],
        correct: 1,
      },
      {
        prompt: 'Which HTTP header should always accompany a JSON request body?',
        options: [
          'Accept: text/plain',
          'X-Requested-With: XMLHttpRequest',
          'Content-Type: application/json',
          'Cache-Control: no-store',
        ],
        correct: 2,
      },
      {
        prompt: 'Two-factor authentication (2FA) adds a second factor. Which pairing correctly describes the two factors for an OTP email login?',
        options: [
          'Something you know (password) + something you have (email inbox)',
          'Something you are (biometric) + something you know (PIN)',
          'Something you have (hardware token) + something you are (fingerprint)',
          'Something you know (username) + something you have (hardware token)',
        ],
        correct: 0,
      },
      {
        prompt: 'What is the recommended approach when a dependency is flagged with a high-severity CVE?',
        options: [
          'Ignore it unless a customer reports a problem',
          'Assess whether the vulnerable code path is reachable, then patch or mitigate promptly',
          'Immediately remove the dependency without testing the replacement',
          'Wait for the annual security audit to address it',
        ],
        correct: 1,
      },
      {
        prompt: 'Why should user-supplied data never be interpolated directly into a SQL string?',
        options: [
          'It makes queries slower by bypassing the query planner',
          'It can expose internal table names to the client',
          'It risks SQL injection, allowing an attacker to read or modify arbitrary data',
          'It causes type errors in strongly-typed ORMs',
        ],
        correct: 2,
      },
    ],
  },
  {
    name:        'Architecture & Code Quality',
    description: 'Tests understanding of the system design, data model, and quality standards.',
    questions: [
      {
        prompt: 'In the App Router, where should data fetching for a page\'s initial load be performed?',
        options: [
          'Inside a useEffect hook in a Client Component',
          'In a Server Component, at the page or layout level',
          'In a global Redux store initialised on the client',
          'In a separate API route called by the Client Component on mount',
        ],
        correct: 1,
      },
      {
        prompt: 'What does the TypeScript strict flag enforce that is disabled without it?',
        options: [
          'Preventing the use of the any type entirely',
          'Null and undefined checks, among other stricter checks, that catch real runtime bugs',
          'Blocking the use of arrow functions',
          'Enforcing alphabetical ordering of imports',
        ],
        correct: 1,
      },
      {
        prompt: 'A function receives a value typed as string | null. Without a null check, what happens if you call .toLowerCase() on it directly?',
        options: [
          'TypeScript silently coerces null to an empty string',
          'The TypeScript compiler raises a type error, and at runtime it would throw',
          'It returns an empty string at runtime with no error',
          'It works fine — null has a .toLowerCase() method that returns null',
        ],
        correct: 1,
      },
      {
        prompt: 'Why are Supabase Row Level Security policies important even when using the service-role key in server actions?',
        options: [
          'They are not important; the service-role key overrides all policies',
          'They provide defence-in-depth: if a bug bypasses the server action, RLS still blocks the data access',
          'They are only relevant for client-side queries, not server-side ones',
          'They speed up queries by reducing the rows the database has to scan',
        ],
        correct: 1,
      },
      {
        prompt: 'What is a "server action" in Next.js App Router?',
        options: [
          'A REST endpoint defined in app/api/ that returns JSON',
          'An async function marked with "use server" that runs exclusively on the server and can be called from a Client Component',
          'A middleware function that intercepts all incoming requests',
          'A background job that runs on a cron schedule',
        ],
        correct: 1,
      },
      {
        prompt: 'When should you add a database index?',
        options: [
          'On every column by default to maximise read performance',
          'Only on primary keys, never on foreign keys',
          'On columns that are frequently used in WHERE, JOIN or ORDER BY clauses with large tables',
          'On text columns only, never on integer or UUID columns',
        ],
        correct: 2,
      },
    ],
  },
]

const PM_QUIZZES = [
  {
    name:        'Project Governance & Methodology',
    description: 'Covers governance frameworks, delivery methodologies, and decision-making.',
    questions: [
      {
        prompt: 'Which document formally authorises a project to begin and names the project manager?',
        options: [
          'Project Status Report',
          'Project Charter',
          'Risk Register',
          'Stakeholder Map',
        ],
        correct: 1,
      },
      {
        prompt: 'In Agile, what is the purpose of a Sprint Retrospective?',
        options: [
          'To plan the work for the next sprint',
          'To demo completed work to stakeholders',
          'To reflect on the team\'s process and identify improvements',
          'To estimate the remaining backlog items',
        ],
        correct: 2,
      },
      {
        prompt: 'A project\'s scope, time, and cost are often called the "triple constraint". If scope increases with no change to schedule, what typically has to give?',
        options: [
          'Quality decreases',
          'Cost increases or scope must be re-negotiated',
          'The project is automatically cancelled',
          'Nothing — scope can always be added without consequence',
        ],
        correct: 1,
      },
      {
        prompt: 'What is a RACI matrix used for?',
        options: [
          'Tracking the financial budget across workstreams',
          'Clarifying Responsible, Accountable, Consulted, and Informed roles for each task',
          'Scheduling meetings with stakeholders',
          'Documenting lessons learned at project close',
        ],
        correct: 1,
      },
      {
        prompt: 'What does a red RAG status on a project status report indicate?',
        options: [
          'The project is on track with minor risks',
          'The project requires attention but is recoverable without escalation',
          'The project has a significant issue that requires immediate management action',
          'The project has been cancelled',
        ],
        correct: 2,
      },
      {
        prompt: 'Which technique is used to identify the longest sequence of dependent tasks that determines the minimum project duration?',
        options: [
          'SWOT Analysis',
          'Critical Path Method (CPM)',
          'Monte Carlo Simulation',
          'Earned Value Management',
        ],
        correct: 1,
      },
      {
        prompt: 'A stakeholder has high influence but low interest in your project. Which engagement strategy is most appropriate?',
        options: [
          'Manage closely — involve them in every decision',
          'Monitor — check in occasionally but do not over-communicate',
          'Keep satisfied — communicate proactively about key decisions that may affect them',
          'Ignore — they have expressed no interest so do not disturb them',
        ],
        correct: 2,
      },
      {
        prompt: 'Earned Value (EV) is less than Planned Value (PV). What does this mean?',
        options: [
          'The project is under budget',
          'The project is ahead of schedule',
          'The project is behind schedule',
          'The project has been completed early',
        ],
        correct: 2,
      },
    ],
  },
  {
    name:        'Risk & Stakeholder Management',
    description: 'Tests knowledge of risk identification, assessment, and stakeholder engagement.',
    questions: [
      {
        prompt: 'What is the first step in the risk management process?',
        options: [
          'Quantify the financial impact of each risk',
          'Assign risk owners from the project team',
          'Identify risks that could affect the project',
          'Report all risks to the programme board immediately',
        ],
        correct: 2,
      },
      {
        prompt: 'A risk has a 30% probability of occurring and would cause a £50,000 impact. What is its Expected Monetary Value (EMV)?',
        options: [
          '£50,000',
          '£30,000',
          '£15,000',
          '£1,500',
        ],
        correct: 2,
      },
      {
        prompt: 'Which risk response strategy involves transferring the negative impact to a third party?',
        options: [
          'Accept',
          'Avoid',
          'Mitigate',
          'Transfer',
        ],
        correct: 3,
      },
      {
        prompt: 'A key stakeholder misses three consecutive status meetings. What is the most appropriate response?',
        options: [
          'Remove them from the distribution list since they are clearly not interested',
          'Escalate to the programme board immediately',
          'Contact them directly to understand their concerns and adjust engagement style',
          'Continue sending meeting invites and wait for them to re-engage',
        ],
        correct: 2,
      },
      {
        prompt: 'What distinguishes an "issue" from a "risk" on a project?',
        options: [
          'Issues are always financial; risks are always schedule-related',
          'An issue has already occurred; a risk is a potential future event',
          'Issues are owned by the project manager; risks are owned by sponsors',
          'There is no distinction — the terms are interchangeable',
        ],
        correct: 1,
      },
      {
        prompt: 'Why is stakeholder analysis performed at the start of a project?',
        options: [
          'To set performance targets for each stakeholder',
          'To identify who needs to be engaged, how, and at what level of detail',
          'To calculate the project\'s total budget',
          'To assign roles and responsibilities in the RACI matrix',
        ],
        correct: 1,
      },
    ],
  },
  {
    name:        'Tools & Communication',
    description: 'Covers project tracking tools, reporting standards, and communication best practice.',
    questions: [
      {
        prompt: 'Which of the following is the primary purpose of a project status report?',
        options: [
          'To document the project\'s technical architecture',
          'To provide stakeholders with a clear, concise summary of progress, issues, and next steps',
          'To replace all face-to-face stakeholder meetings',
          'To record every task completed during the reporting period in full detail',
        ],
        correct: 1,
      },
      {
        prompt: 'When sending a project update to senior leadership, which principle should guide your writing?',
        options: [
          'Include all available data so they can draw their own conclusions',
          'Lead with the most important information and keep it brief',
          'Use technical language to demonstrate expertise',
          'Send the full project plan as an attachment',
        ],
        correct: 1,
      },
      {
        prompt: 'A Gantt chart is best suited for which of the following?',
        options: [
          'Tracking individual team members\' mood and motivation',
          'Visualising the project schedule, dependencies, and milestones over time',
          'Calculating the budget variance at project close',
          'Documenting decisions made in steering committee meetings',
        ],
        correct: 1,
      },
      {
        prompt: 'What is the primary advantage of using a shared project management tool over email threads for task tracking?',
        options: [
          'It eliminates the need for any status meetings',
          'It provides a single source of truth that all team members can see and update in real time',
          'It automatically generates the project charter',
          'It replaces the need for a project manager',
        ],
        correct: 1,
      },
      {
        prompt: 'A project update email has no clear subject line, three separate threads quoted inside it, and asks five different questions. What is the likely outcome?',
        options: [
          'Recipients will read it carefully and respond to all questions',
          'The email will be processed efficiently by email filters',
          'Key questions will be missed, responses will be delayed, and confusion will increase',
          'It demonstrates thoroughness and builds stakeholder confidence',
        ],
        correct: 2,
      },
      {
        prompt: 'What does "lessons learned" documentation capture?',
        options: [
          'The names of team members who underperformed',
          'What worked well and what should be done differently, so future projects can benefit',
          'The financial audit trail for project expenditure',
          'A list of all risks that materialised',
        ],
        correct: 1,
      },
      {
        prompt: 'When is the best time to raise a change request?',
        options: [
          'After the change has already been implemented',
          'Only at the end of the project during lessons learned',
          'As soon as any change to scope, schedule, or budget is proposed',
          'Quarterly, to batch all changes together for efficiency',
        ],
        correct: 2,
      },
    ],
  },
]

// ─── Question heatmap categories ──────────────────────────────────────────────

const QUESTION_CATEGORIES = [
  { category: 'laptop_setup',     label: 'Laptop setup'       },
  { category: 'access_requests',  label: 'Access requests'    },
  { category: 'time_off',         label: 'Time off'           },
  { category: 'expenses',         label: 'Expenses'           },
  { category: 'team_processes',   label: 'Team processes'     },
  { category: 'tools_software',   label: 'Tools & software'   },
  { category: 'hr_policies',      label: 'HR policies'        },
  { category: 'it_support',       label: 'IT support'         },
]

const SAMPLE_QUESTIONS = [
  'How do I set up my laptop?',
  'How do I request VPN access?',
  'What is the holiday allowance?',
  'How do I submit an expense claim?',
  'Where is the team wiki?',
  'How do I get access to the code repository?',
  'What is the sick leave policy?',
  'How do I log a support ticket?',
  'What tools does the team use?',
  'How do I book a meeting room?',
]

// ─── Completion buckets ───────────────────────────────────────────────────────
//
// Each person gets one of these buckets, cycling predictably so the two teams
// look different and every bucket has at least one person.

const BUCKETS_DEV = [
  'never', 'partial', 'partial', 'finished', 'finished',
  'feedback', 'never', 'finished', 'partial', 'feedback',
  'finished', 'never', 'partial', 'finished', 'feedback',
]

const BUCKETS_PM = [
  'finished', 'never', 'feedback', 'partial', 'finished',
  'never', 'partial', 'finished', 'feedback', 'partial',
  'never', 'finished', 'partial', 'feedback', 'finished',
]

const BUCKETS_PM2 = [
  'partial', 'feedback', 'finished', 'never', 'partial',
  'finished', 'feedback', 'never', 'finished', 'partial',
  'feedback', 'partial', 'never', 'finished', 'feedback',
]

// Score profiles: probability of choosing the correct answer per person index
// (0 = always wrong, 1 = always right). Mix strong, middling, weak.
const SCORE_PROFILES_DEV  = [0.9, 0.95, 0.7, 0.85, 0.6, 0.5, 0.9, 0.75, 0.4, 0.8, 0.65, 0.95, 0.55, 0.7, 0.85]
const SCORE_PROFILES_PM   = [0.8, 0.6,  0.9, 0.45, 0.7, 0.95, 0.55, 0.85, 0.65, 0.9, 0.4, 0.75, 0.8, 0.5, 0.95]
const SCORE_PROFILES_PM2  = [0.5, 0.85, 0.65, 0.95, 0.4, 0.75, 0.9, 0.55, 0.8, 0.45, 0.95, 0.6, 0.7, 0.85, 0.5]

// ─── 0. Teardown ──────────────────────────────────────────────────────────────

if (values.teardown) {
  section('Teardown mode — deleting all fake starters')

  // List all auth users whose email ends with FAKE_DOMAIN
  let fakeUsers = []
  const { data: { users: allUsers }, error: listErr } =
    await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) die('Failed to list auth users', listErr)

  fakeUsers = allUsers.filter(u => u.email?.endsWith(FAKE_DOMAIN))

  if (fakeUsers.length === 0) {
    console.log('\nNo fake starters found. Nothing to delete.')
    process.exit(0)
  }

  log(`Found ${fakeUsers.length} fake auth users to delete.`)

  let deleted = 0
  for (const u of fakeUsers) {
    // Cascade via profiles → tasks, quiz_assignments → quiz_answers, user_questions
    // is handled by ON DELETE CASCADE on the FK chains. Deleting the auth user
    // cascades to profiles, which cascades to everything else.
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) die(`Failed to delete auth user ${u.email}`, error)
    deleted++
  }

  console.log(`\n✓ Teardown complete. Deleted ${deleted} fake starter(s).`)
  console.log('  Quizzes, job roles, and task templates were left intact.')
  process.exit(0)
}

// ─── 1. Look up both supervisors ──────────────────────────────────────────────

section('Resolving supervisors')

async function lookupSupervisor(email, flagName) {
  // Auth user
  const { data: { users }, error: authErr } =
    await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) die(`Failed to list auth users while looking up ${flagName}`, authErr)

  const authUser = users.find(u => u.email === email)
  if (!authUser) die(`${flagName} (${email}) not found in auth.users. Run provision first.`)

  const role = authUser.app_metadata?.role
  if (role !== 'supervisor') die(`${flagName} (${email}) has role "${role}", not "supervisor".`)

  const orgId = authUser.app_metadata?.org_id
  if (!orgId) die(`${flagName} (${email}) has no org_id in app_metadata.`)

  // Profile row
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, org_id')
    .eq('id', authUser.id)
    .maybeSingle()
  if (profileErr) die(`Failed to load profile for ${flagName}`, profileErr)
  if (!profile) die(`Profile row missing for ${flagName} (${email}). Auth user exists but profile does not.`)

  log(`✓ ${flagName}: ${profile.full_name} (${email}) — org ${orgId}`)
  return { id: profile.id, name: profile.full_name, orgId }
}

const arda  = await lookupSupervisor(values.arda,  '--arda')
const arman = await lookupSupervisor(values.arman, '--arman')

if (arda.orgId !== arman.orgId) {
  die(`Supervisors are in different organisations (${arda.orgId} vs ${arman.orgId}). They must share an org.`)
}

const orgId = arda.orgId

let benjamin = null
if (values.benjamin) {
  benjamin = await lookupSupervisor(values.benjamin, '--benjamin')
  if (benjamin.orgId !== orgId) {
    die(`--benjamin supervisor (${values.benjamin}) is in a different organisation (${benjamin.orgId} vs ${orgId}). All supervisors must share an org.`)
  }
}

const supervisorCount = benjamin ? 3 : 2
log(`✓ ${supervisorCount} supervisor(s) confirmed in org ${orgId}`)

// ─── 2. Ensure job roles ──────────────────────────────────────────────────────

section('Ensuring job roles')

async function upsertRole(name) {
  const { data: existing } = await supabase
    .from('job_roles')
    .select('id, name')
    .eq('org_id', orgId)
    .ilike('name', name)
    .maybeSingle()

  if (existing) {
    log(`✓ Role "${name}" already exists (${existing.id})`)
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('job_roles')
    .insert({ org_id: orgId, name })
    .select('id')
    .single()
  if (error) die(`Failed to create job role "${name}"`, error)
  log(`✓ Created role "${name}" (${created.id})`)
  return created.id
}

const devRoleId = await upsertRole('Development')
const pmRoleId  = await upsertRole('Project Management')

// ─── 3. Ensure task templates ─────────────────────────────────────────────────

section('Ensuring task templates')

async function upsertTemplates(roleId, roleName, titles) {
  const { data: existing } = await supabase
    .from('task_templates')
    .select('id, title')
    .eq('org_id', orgId)
    .eq('job_role_id', roleId)

  const existingTitles = new Set((existing ?? []).map(t => t.title.toLowerCase()))
  let created = 0

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]
    if (existingTitles.has(title.toLowerCase())) continue

    const { error } = await supabase.from('task_templates').insert({
      org_id:      orgId,
      job_role_id: roleId,
      title,
      description: '',
      order_index: i,
    })
    if (error) die(`Failed to create task template "${title}" for ${roleName}`, error)
    created++
  }

  const total = (existing ?? []).length + created
  log(`✓ ${roleName}: ${total} task template(s) (${created} new)`)

  // Return all templates for this role
  const { data: all, error: fetchErr } = await supabase
    .from('task_templates')
    .select('id, title, order_index')
    .eq('org_id', orgId)
    .eq('job_role_id', roleId)
    .order('order_index', { ascending: true })
  if (fetchErr) die(`Failed to fetch task templates for ${roleName}`, fetchErr)
  return all
}

const devTemplates = await upsertTemplates(devRoleId, 'Development', DEV_TASKS)
const pmTemplates  = await upsertTemplates(pmRoleId,  'Project Management', PM_TASKS)

// ─── 4. Ensure quizzes ────────────────────────────────────────────────────────

section('Ensuring quizzes')

async function upsertQuizzes(roleId, roleName, supervisorId, quizDefs) {
  const quizIds = []

  for (const def of quizDefs) {
    // Check if quiz with this name already exists for the org
    const { data: existing } = await supabase
      .from('quizzes')
      .select('id, name')
      .eq('org_id', orgId)
      .ilike('name', def.name)
      .maybeSingle()

    let quizId

    if (existing) {
      log(`  ✓ Quiz "${def.name}" already exists`)
      quizId = existing.id
    } else {
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          org_id:      orgId,
          name:        def.name,
          description: def.description,
          created_by:  supervisorId,
        })
        .select('id')
        .single()
      if (quizErr) die(`Failed to create quiz "${def.name}"`, quizErr)
      quizId = quiz.id

      // Insert questions
      for (let qi = 0; qi < def.questions.length; qi++) {
        const q = def.questions[qi]
        const { error: qErr } = await supabase.from('quiz_questions').insert({
          quiz_id:        quizId,
          kind:           'multiple_choice',
          prompt:         q.prompt,
          options:        q.options,
          correct_option: q.correct,
          model_answer:   null,
          order_index:    qi,
        })
        if (qErr) die(`Failed to insert question ${qi + 1} for quiz "${def.name}"`, qErr)
      }

      log(`  ✓ Created quiz "${def.name}" (${def.questions.length} questions)`)
    }

    // Attach to job role (idempotent — primary key on (job_role_id, quiz_id))
    const { error: linkErr } = await supabase
      .from('job_role_quizzes')
      .upsert({ job_role_id: roleId, quiz_id: quizId })
    if (linkErr && linkErr.code !== '23505') die(`Failed to link quiz to role`, linkErr)

    quizIds.push(quizId)
  }

  log(`✓ ${roleName}: ${quizIds.length} quiz(zes) linked to role`)
  return quizIds
}

const devQuizIds = await upsertQuizzes(devRoleId, 'Development',        arda.id,  DEV_QUIZZES)
const pmQuizIds  = await upsertQuizzes(pmRoleId,  'Project Management', arman.id, PM_QUIZZES)
// pmQuizIds is reused for the third team — no new quizzes are created

// Fetch all questions for each quiz bank so we can write answers later
async function fetchQuizQuestions(quizIds) {
  const map = {}
  for (const qId of quizIds) {
    const { data: qs, error } = await supabase
      .from('quiz_questions')
      .select('id, correct_option, options')
      .eq('quiz_id', qId)
      .order('order_index', { ascending: true })
    if (error) die(`Failed to fetch questions for quiz ${qId}`, error)
    map[qId] = qs
  }
  return map
}

const devQuestions = await fetchQuizQuestions(devQuizIds)
const pmQuestions  = await fetchQuizQuestions(pmQuizIds)
// The third team shares the same PM questions

// ─── 5. Create fake interns ────────────────────────────────────────────────────

section('Creating fake interns')

async function createInterns(people, supervisor, roleId, templates, quizIds, questionMap, buckets, scoreProfiles, teamName) {
  let created = 0
  let skipped = 0
  let assignmentsCreated = 0
  let answersCreated = 0

  for (let idx = 0; idx < people.length; idx++) {
    const person = people[idx]
    const email  = makeEmail(person.first, person.last)
    const bucket = buckets[idx]
    const scoreProbability = scoreProfiles[idx]

    // ── Check if already exists ────────────────────────────────────────────────
    const { data: { users: existingUsers }, error: findErr } =
      await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (findErr) die(`Failed to list users while checking ${email}`, findErr)

    const existing = existingUsers.find(u => u.email === email)
    if (existing) {
      log(`  ↷ ${person.first} ${person.last} (${email}) already exists — skipping`)
      skipped++
      continue
    }

    // ── Create auth user ───────────────────────────────────────────────────────
    const startDateIso = makeStartDate(person.start)
    const createdAt    = randomPastDate(Math.abs(person.start) + 1, Math.abs(person.start) + 5)

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,   // no invitation email
      app_metadata: {
        org_id: orgId,
        role:   'intern',
      },
    })
    if (authErr) die(`Failed to create auth user for ${email}`, authErr)
    const userId = authData.user.id

    // ── Create profile ─────────────────────────────────────────────────────────
    const { error: profileErr } = await supabase.from('profiles').insert({
      id:            userId,
      org_id:        orgId,
      role:          'intern',
      full_name:     `${person.first} ${person.last}`,
      supervisor_id: supervisor.id,
      job_title:     person.title,
      team:          teamName,
      job_role_id:   roleId,
      start_date:    startDateIso,
      created_at:    createdAt,
    })
    if (profileErr) {
      await supabase.auth.admin.deleteUser(userId)
      die(`Failed to create profile for ${email}`, profileErr)
    }

    // ── Copy tasks from templates ──────────────────────────────────────────────
    const taskCount = templates.length
    // How many tasks are done: varies by bucket and seeded randomness
    const doneFraction = bucket === 'never' ? 0
      : bucket === 'partial' ? 0.2 + seededFloat(email + 'tasks') * 0.5
      : 0.6 + seededFloat(email + 'tasks') * 0.4   // finished / feedback

    const doneCount = Math.round(doneFraction * taskCount)

    const taskRows = templates.map((tmpl, ti) => {
      const isDone      = ti < doneCount
      const completedAt = isDone ? randomPastDate(2, Math.abs(person.start) + 3) : null
      return {
        org_id:      orgId,
        profile_id:  userId,
        template_id: tmpl.id,
        title:       tmpl.title,
        description: '',
        status:      isDone ? 'done' : 'pending',
        completed_at: completedAt,
        order_index: ti,
        created_at:  createdAt,
      }
    })

    const { error: taskErr } = await supabase.from('tasks').insert(taskRows)
    if (taskErr) die(`Failed to insert tasks for ${email}`, taskErr)

    // ── Assign quizzes and simulate completion ─────────────────────────────────
    for (const quizId of quizIds) {
      const questions = questionMap[quizId] ?? []
      const assignedAt = randomPastDate(Math.abs(person.start) - 3, Math.abs(person.start) + 2)

      // How many questions answered (for partial / finished / feedback)
      const answeredFraction = bucket === 'never' ? 0
        : bucket === 'partial' ? 0.2 + seededFloat(email + quizId + 'q') * 0.6
        : 1.0

      const answeredCount = Math.round(answeredFraction * questions.length)
      const isComplete    = answeredCount === questions.length

      const status =
        bucket === 'never'    ? 'assigned'
        : !isComplete         ? 'in_progress'
        : 'published'

      const completedAt  = isComplete ? randomPastDate(1, Math.abs(person.start)) : null
      const publishedAt  = isComplete ? completedAt : null

      // Overall feedback for the 'feedback' bucket
      const overallFeedback = (bucket === 'feedback' && isComplete)
        ? `Good effort, ${person.first}. Keep working on the areas where you are less confident.`
        : null

      const { data: assignment, error: assignErr } = await supabase
        .from('quiz_assignments')
        .insert({
          org_id:           orgId,
          quiz_id:          quizId,
          profile_id:       userId,
          assigned_by:      supervisor.id,
          status,
          assigned_at:      assignedAt,
          completed_at:     completedAt,
          published_at:     publishedAt,
          overall_feedback: overallFeedback,
          reviewed_by:      isComplete ? supervisor.id : null,
        })
        .select('id')
        .single()
      if (assignErr) die(`Failed to create assignment for ${email} quiz ${quizId}`, assignErr)
      assignmentsCreated++

      if (answeredCount === 0) continue

      // Write answers for the questions that were answered
      const answerRows = []
      for (let qi = 0; qi < answeredCount; qi++) {
        const q = questions[qi]
        // Decide correct vs incorrect based on score profile + seeded noise
        const noise = seededFloat(email + quizId + qi)
        const chooseCorrect = noise < scoreProbability
        const selectedOption = chooseCorrect
          ? q.correct_option
          : (q.correct_option + 1) % q.options.length   // wrong but adjacent

        answerRows.push({
          assignment_id:   assignment.id,
          question_id:     q.id,
          selected_option: selectedOption,
          text_answer:     null,
          // Do NOT write score — the auto-score trigger sets it on INSERT
        })
      }

      const { error: ansErr } = await supabase.from('quiz_answers').insert(answerRows)
      if (ansErr) die(`Failed to insert answers for ${email} quiz ${quizId}`, ansErr)
      answersCreated += answerRows.length

      // ── Verify trigger scored the answers ──────────────────────────────────
      const { data: scored, error: checkErr } = await supabase
        .from('quiz_answers')
        .select('id, score')
        .eq('assignment_id', assignment.id)
        .is('score', null)
      if (checkErr) die(`Failed to verify scores for ${email} quiz ${quizId}`, checkErr)
      if ((scored ?? []).length > 0) {
        die(`Auto-score trigger did not fire for ${email} quiz ${quizId} — ${scored.length} answer(s) have null score. Check the trigger is attached to INSERT.`)
      }

      // ── Per-question supervisor comments for 'feedback' bucket ────────────
      if (bucket === 'feedback' && isComplete) {
        // Comment on the first two answered questions
        const commentTargets = answerRows.slice(0, 2)
        for (const ans of commentTargets) {
          // Fetch the answer id we just inserted
          const { data: ansRow } = await supabase
            .from('quiz_answers')
            .select('id, score')
            .eq('assignment_id', assignment.id)
            .eq('question_id', ans.question_id)
            .maybeSingle()
          if (!ansRow) continue

          const comment = ansRow.score === 100
            ? 'Good answer — solid understanding shown here.'
            : 'Review this topic again before your next quiz.'

          const { error: commentErr } = await supabase
            .from('quiz_answers')
            .update({ supervisor_comment: comment })
            .eq('id', ansRow.id)
          if (commentErr) die(`Failed to write supervisor comment for ${email}`, commentErr)
        }
      }
    }

    // ── Write question heatmap rows ────────────────────────────────────────────
    // Scatter 2–5 questions per person across different categories and dates
    const questionCount = 2 + Math.floor(seededFloat(email + 'heatmap') * 4)
    const heatmapRows = []

    for (let qi = 0; qi < questionCount; qi++) {
      const catIdx  = Math.floor(seededFloat(email + 'cat' + qi) * QUESTION_CATEGORIES.length)
      const qIdx    = Math.floor(seededFloat(email + 'qs' + qi)  * SAMPLE_QUESTIONS.length)
      const cat     = QUESTION_CATEGORIES[catIdx]
      const askedAt = randomPastDate(1, Math.abs(person.start) + 10)

      heatmapRows.push({
        org_id:         orgId,
        user_id:        userId,
        question:       SAMPLE_QUESTIONS[qIdx],
        category:       cat.category,
        category_label: cat.label,
        asked_at:       askedAt,
      })
    }

    const { error: heatmapErr } = await supabase.from('user_questions').insert(heatmapRows)
    if (heatmapErr) die(`Failed to insert heatmap rows for ${email}`, heatmapErr)

    log(`  ✓ ${person.first} ${person.last} (${email}) — bucket: ${bucket}`)
    created++
  }

  return { created, skipped, assignmentsCreated, answersCreated }
}

const devResult = await createInterns(
  DEV_PEOPLE, arda,  devRoleId, devTemplates, devQuizIds, devQuestions,
  BUCKETS_DEV, SCORE_PROFILES_DEV, 'Development',
)

const pmResult = await createInterns(
  PM_PEOPLE, arman, pmRoleId, pmTemplates, pmQuizIds, pmQuestions,
  BUCKETS_PM, SCORE_PROFILES_PM, 'Project Management',
)

let pm2Result = { created: 0, skipped: 0, assignmentsCreated: 0, answersCreated: 0 }
if (benjamin) {
  pm2Result = await createInterns(
    PM2_PEOPLE, benjamin, pmRoleId, pmTemplates, pmQuizIds, pmQuestions,
    BUCKETS_PM2, SCORE_PROFILES_PM2, 'Project Management',
  )
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const totalCreated     = devResult.created     + pmResult.created     + pm2Result.created
const totalSkipped     = devResult.skipped     + pmResult.skipped     + pm2Result.skipped
const totalAssignments = devResult.assignmentsCreated + pmResult.assignmentsCreated + pm2Result.assignmentsCreated
const totalAnswers     = devResult.answersCreated     + pmResult.answersCreated     + pm2Result.answersCreated

const pm2Line = benjamin
  ? ` / ${pm2Result.created} PM-2`
  : ''

console.log(`
─────────────────────────────────────────────────────
Seed complete.

  New starters created : ${totalCreated}  (${devResult.created} dev / ${pmResult.created} PM${pm2Line})
  Already existed      : ${totalSkipped}  (skipped)
  Quiz assignments     : ${totalAssignments}
  Quiz answers written : ${totalAnswers}

  Dev quizzes   : ${devQuizIds.length}  (linked to "Development" role)
  PM quizzes    : ${pmQuizIds.length}  (linked to "Project Management" role, shared by all PM teams)

  Fake domain   : ${FAKE_DOMAIN}
  Org ID        : ${orgId}

To tear down all fake starters:
  npm run seed-demo -- --arda "${values.arda}" --arman "${values.arman}"${values.benjamin ? ` --benjamin "${values.benjamin}"` : ''} --teardown
─────────────────────────────────────────────────────
`)
