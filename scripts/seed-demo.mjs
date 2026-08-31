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
 * Usage (refresh questions only — replaces asked-question rows for existing fake starters):
 *   npm run seed-demo -- --arda "arda@example.com" --arman "arman@example.com" --refresh-questions
 *
 * Flags:
 *   --arda    <email>   Email of the supervisor who owns the Development team
 *   --arman   <email>   Email of the supervisor who owns the first Project Management team
 *   --benjamin <email>   (Optional) Email of the supervisor who owns the second Project
 *                       Management team. When omitted only the two existing teams are seeded.
 *   --teardown          Delete all fake starters (matched by the FAKE_DOMAIN
 *                       constant below) and everything they own, then exit.
 *   --refresh-questions For each already-seeded fake starter, delete their existing
 *                       user_questions rows and write fresh ones drawn from their
 *                       team's department-specific category set. Does not create
 *                       any people, tasks, quiz assignments or quiz answers.
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
    arda:                { type: 'string' },
    arman:               { type: 'string' },
    benjamin:            { type: 'string' },
    teardown:            { type: 'boolean', default: false },
    'refresh-questions': { type: 'boolean', default: false },
  },
})

if (!values.arda || !values.arman) {
  console.error([
    'Error: --arda and --arman are required.',
    '',
    'Seed (two teams):       npm run seed-demo -- --arda <email> --arman <email>',
    'Seed (three teams):     npm run seed-demo -- --arda <email> --arman <email> --benjamin <email>',
    'Teardown:               npm run seed-demo -- --arda <email> --arman <email> --teardown',
    'Refresh questions only: npm run seed-demo -- --arda <email> --arman <email> --refresh-questions',
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

/**
 * Like randomPastDate but also randomises the time-of-day within working hours
 * (08:00–18:00) with a random minute, so each row gets a distinct timestamp.
 */
function randomPastWorkingTime(minDaysAgo = 1, maxDaysAgo = 120) {
  const offset = minDaysAgo + Math.floor(Math.random() * (maxDaysAgo - minDaysAgo))
  const hour   = 8 + Math.floor(Math.random() * 10)   // 08–17 inclusive
  const minute = Math.floor(Math.random() * 60)
  const d = new Date(Date.now() - offset * 86_400_000)
  d.setHours(hour, minute, 0, 0)
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

// ─── Question heatmap — department-specific category sets ─────────────────────
//
// Each entry carries:
//   category  — short snake_case key stored in the DB
//   label     — human-readable label shown in the heatmap tile
//   weight    — relative likelihood of being chosen (higher = more questions)
//               so the heatmap has an uneven, realistic shape
//   questions — array of { text, platform } objects.
//               platform is a lowercase identifier (letters, digits, underscores)
//               matching the product the question is about, or null when the
//               question is about process rather than a specific tool.

const DEV_CATEGORIES = [
  {
    category: 'repo_and_git',
    label: 'Repo & Git',
    weight: 5,
    questions: [
      { text: 'What is our branching strategy and how should I name my feature branches?',       platform: 'github' },
      { text: 'Do I need to squash commits before raising a pull request?',                      platform: 'github' },
      { text: "I can't push to main — is that expected or have I lost access?",                  platform: 'github' },
      { text: 'Where can I find the commit message convention we follow?',                        platform: 'github' },
      { text: 'How do I rebase my branch on top of the latest main without breaking things?',    platform: 'github' },
    ],
  },
  {
    category: 'local_dev_env',
    label: 'Local dev environment',
    weight: 5,
    questions: [
      { text: 'What version of Node is the project expecting — should I use nvm or something else?',                     platform: 'node'       },
      { text: "The Docker Compose stack starts but the app can't reach the database. What should I check first?",        platform: 'docker'     },
      { text: 'Where in Confluence is the .env.local setup guide that lists every value I need to fill in?',             platform: 'confluence' },
      { text: "I'm on an M-series Mac and native modules won't install — is there a Slack thread with the workaround?",  platform: 'slack'      },
      { text: 'Is there a seed script in the GitHub repo I should run after a fresh database wipe?',                     platform: 'github'     },
    ],
  },
  {
    category: 'ci_cd',
    label: 'CI / CD pipeline',
    weight: 4,
    questions: [
      { text: 'My GitHub Actions check is failing on lint but passes locally — where do I look first?',                        platform: 'github' },
      { text: 'How do I re-run just the failed jobs in a GitHub Actions workflow without triggering everything?',               platform: 'github' },
      { text: 'What GitHub Actions event triggers a production deploy and do I need to approve the environment manually?',      platform: 'github' },
      { text: 'The GitHub Actions pipeline failed on a flaky test — am I expected to re-run it myself or wait for someone?',   platform: 'github' },
      { text: 'Where in GitHub can I see the history of recent deploys and which commits they included?',                       platform: 'github' },
    ],
  },
  {
    category: 'code_review',
    label: 'Code review',
    weight: 4,
    questions: [
      { text: 'How many approvals does a GitHub PR need before I can merge it?',                                                            platform: 'github' },
      { text: 'Is there a time-limit convention for how long GitHub reviewers have to respond before I can reassign?',                      platform: 'github' },
      { text: 'What is the difference between a comment and a blocking review in GitHub — can I merge with unresolved comments?',           platform: 'github' },
      { text: 'Should I be self-reviewing my GitHub PR description before requesting review, and if so what does that mean in practice?',   platform: 'github' },
      { text: 'I got a GitHub review with a lot of nits — am I supposed to address all of them before merging or just the blocking ones?',  platform: 'github' },
    ],
  },
  {
    category: 'deployment',
    label: 'Deployments',
    weight: 3,
    questions: [
      { text: 'Do we have a deployment freeze period around releases and how is it communicated — is there a Slack channel?',    platform: 'slack'  },
      { text: 'If something I deploy causes an error spike, what is the rollback procedure and where do I announce it in Slack?', platform: 'slack'  },
      { text: 'How do I target only the staging environment in GitHub Actions without the change going to production as well?',   platform: 'github' },
      { text: 'Which Slack channel should I post in before deploying a change that touches the payments service?',               platform: 'slack'  },
      { text: 'Is there a CHANGELOG file in the GitHub repo that I should update when I ship something user-facing?',            platform: 'github' },
    ],
  },
  {
    category: 'monitoring_and_alerts',
    label: 'Monitoring & alerts',
    weight: 3,
    questions: [
      { text: 'How do I find the logs for my service in Datadog without trawling through everything?',                 platform: 'datadog' },
      { text: 'I triggered a Datadog alert in staging — do I need to acknowledge it or will it clear on its own?',    platform: 'datadog' },
      { text: 'Which Datadog dashboard should I be watching for error rates after a deploy?',                          platform: 'datadog' },
      { text: 'How do I tell in Datadog whether a latency spike is from my change or something external?',             platform: 'datadog' },
      { text: 'Where do I find the PagerDuty on-call schedule if I need to escalate something I see in Datadog?',     platform: 'pagerduty' },
    ],
  },
  {
    category: 'secrets_and_config',
    label: 'Secrets & config',
    weight: 3,
    questions: [
      { text: 'Are production environment variables stored in GitHub Actions secrets or in a separate secrets manager?',              platform: 'github'     },
      { text: 'I need to add a new API key to the GitHub Actions staging environment — who has permission to do that?',               platform: 'github'     },
      { text: 'Are there any secrets in the repo I should know about, or is the rule that secrets never go in git?',                  platform: 'git'        },
      { text: 'How do I rotate a GitHub Actions secret without causing downtime for the service that uses it?',                       platform: 'github'     },
      { text: 'Where in Confluence is the difference between the staging and production config documented?',                          platform: 'confluence' },
    ],
  },
  {
    category: 'testing',
    label: 'Testing',
    weight: 3,
    questions: [
      { text: 'Is there a minimum Jest coverage threshold I need to hit before a GitHub PR can be merged?',                              platform: 'jest'   },
      { text: 'Where in the GitHub repo do unit tests live versus integration tests, and what is the distinction between them?',         platform: 'github' },
      { text: 'Are Cypress E2E tests run on every PR or only on release branches?',                                                      platform: 'cypress' },
      { text: 'I am writing a Jest test for a function that calls an external API — should I mock it or use a test account?',            platform: 'jest'   },
      { text: 'Where in the GitHub repo is the shared test fixture data kept and how do I add to it without breaking existing tests?',   platform: 'github' },
    ],
  },
  {
    category: 'incident_response',
    label: 'Incident response',
    weight: 2,
    questions: [
      { text: 'If I notice something broken in production outside of working hours, should I page the on-call engineer in PagerDuty?',  platform: 'pagerduty' },
      { text: 'Where in Confluence do I file a post-incident review and what is the expected turnaround?',                              platform: 'confluence' },
      { text: 'What counts as a P1 versus a P2 incident in PagerDuty and who makes that severity call?',                               platform: 'pagerduty'  },
      { text: 'Am I expected to join the incident Slack channel as an observer even when it is not my service?',                        platform: 'slack'      },
      { text: 'How do I resolve an incident in PagerDuty and post the all-clear to the incident Slack channel?',                        platform: 'pagerduty'  },
    ],
  },
  {
    category: 'architecture',
    label: 'Architecture',
    weight: 2,
    questions: [
      { text: 'Where in Confluence is the system architecture documented and how do I tell if it is up to date?',                    platform: 'confluence' },
      { text: 'I need to add a new service — is there a Confluence ADR template I should fill out first?',                          platform: 'confluence' },
      { text: 'Where in Confluence is the convention for service-to-service communication — REST, gRPC, or events — documented?',   platform: 'confluence' },
      { text: 'Is there a CODEOWNERS file in GitHub that shows which services I should avoid calling directly?',                    platform: 'github'     },
      { text: 'Who owns the accounts domain data model and how do I raise a schema change in GitHub?',                              platform: 'github'     },
    ],
  },
  {
    category: 'security',
    label: 'Security',
    weight: 2,
    questions: [
      { text: 'Is there a security review checklist in Confluence I need to complete before shipping something that handles user data?', platform: 'confluence' },
      { text: 'Do I need to open a GitHub issue for approval before adding a third-party package as a new dependency?',                 platform: 'github'     },
      { text: 'I spotted what might be a vulnerability — which Slack channel do I post to and who picks it up?',                       platform: 'slack'      },
      { text: 'Where in Confluence is our approach to SQL injection protection documented — ORM only, or parameterised queries too?',   platform: 'confluence' },
      { text: 'Where in Confluence can I find the latest pentest report to understand the known attack surface?',                       platform: 'confluence' },
    ],
  },
  {
    category: 'dependencies',
    label: 'Dependency management',
    weight: 2,
    questions: [
      { text: 'Where in GitHub is the process for deciding when to upgrade a major dependency version documented?',                    platform: 'github'     },
      { text: 'I see a Dependabot PR sitting open for two weeks — am I allowed to merge it or does someone specific own those?',       platform: 'dependabot' },
      { text: 'What is our policy on pinning exact versions versus using ranges in package.json?',                                      platform: 'npm'        },
      { text: 'Is there a GitHub PR process for removing an unused dependency or do I just delete it and open a pull request?',        platform: 'github'     },
      { text: 'A Dependabot alert flagged a critical CVE in one of our transitive dependencies — what is the expected response time?', platform: 'dependabot' },
    ],
  },
  {
    category: 'on_call',
    label: 'On-call',
    weight: 1,
    questions: [
      { text: 'When will I be added to the PagerDuty rota and what do I need to do to prepare?',                                  platform: 'pagerduty' },
      { text: 'Do I need the PagerDuty app on my phone and is there a setup guide?',                                              platform: 'pagerduty' },
      { text: 'Is there a shadowing rotation in PagerDuty before I take my first solo on-call shift?',                            platform: 'pagerduty' },
      { text: 'Is there a Slack channel where the outgoing on-call engineer posts the handover notes?',                           platform: 'slack'     },
      { text: 'How do I claim the on-call compensation — is it automatic or do I submit something via Slack?',                    platform: 'slack'     },
    ],
  },
  {
    category: 'documentation',
    label: 'Documentation',
    weight: 1,
    questions: [
      { text: 'Where in Confluence should I put the runbook for the service I am building?',                                        platform: 'confluence' },
      { text: 'Is there a Confluence style guide for technical documentation or can I use any format I like?',                      platform: 'confluence' },
      { text: 'Should I open a GitHub PR or post in Slack to request a review of documentation I have written?',                   platform: 'slack'      },
      { text: 'Are diagrams kept in the GitHub repo alongside the code or in a separate Confluence space?',                        platform: 'confluence' },
      { text: "My team's README in GitHub is out of date — am I expected to fix it as part of onboarding or raise a ticket?",      platform: 'github'     },
    ],
  },
]

// PM and PM2 share one set — same discipline, same questions.
const PM_CATEGORIES = [
  {
    category: 'project_intake',
    label: 'Project intake',
    weight: 5,
    questions: [
      { text: 'How does a new project get formally initiated here — is there a Confluence template or a kick-off meeting?',      platform: 'confluence' },
      { text: 'Who signs off on the project scope in Confluence before I am allowed to start planning?',                         platform: 'confluence' },
      { text: 'How do I create the Jira project for a new initiative and which project template should I use?',                  platform: 'jira'       },
      { text: 'I have been handed a project with no brief — is there a Confluence brief template I should fill in first?',       platform: 'confluence' },
      { text: 'Where in Jira do I log a decision to decline a project request that does not meet the intake threshold?',         platform: 'jira'       },
    ],
  },
  {
    category: 'stakeholder_management',
    label: 'Stakeholder management',
    weight: 5,
    questions: [
      { text: 'Is there a Confluence page listing the key stakeholders for a project that was already in flight when I joined?',    platform: 'confluence' },
      { text: 'Is there a Confluence page or Slack channel I should join to stay across stakeholder updates on my project?',        platform: 'confluence' },
      { text: 'One of my stakeholders keeps changing their requirements — where in Jira do I log a change request to track this?',  platform: 'jira'       },
      { text: 'Is there a stakeholder map template in Confluence I should fill out at the start of every project?',                 platform: 'confluence' },
      { text: 'If a stakeholder goes around me directly to the delivery team, which Slack channel should I use to escalate that?',  platform: 'slack'      },
    ],
  },
  {
    category: 'risk_register',
    label: 'Risk register',
    weight: 4,
    questions: [
      { text: 'How do I set up a Jira issue type for risks and where is the team\'s current risk board?',                        platform: 'jira'       },
      { text: 'How often is the Jira risk board expected to be reviewed and updated?',                                           platform: 'jira'       },
      { text: 'Where in Confluence is the threshold for escalating a risk from amber to red documented?',                        platform: 'confluence' },
      { text: 'Who else needs to approve a red-rated risk in Jira before I can continue with the plan?',                         platform: 'jira'       },
      { text: 'Should I log a Jira ticket when a risk becomes an issue, or is the risk register entry enough?',                  platform: 'jira'       },
    ],
  },
  {
    category: 'raid_log',
    label: 'RAID log',
    weight: 4,
    questions: [
      { text: 'Do we maintain the RAID log in Confluence or as a Jira board, and where is the current one for my project?',      platform: 'jira'       },
      { text: 'How long do resolved Jira issues stay on the RAID log before they are archived?',                                 platform: 'jira'       },
      { text: 'Who owns actions on the RAID log — me as PM or the Jira assignee on each action ticket?',                         platform: 'jira'       },
      { text: 'Where in Confluence is the threshold for issues that requires me to notify the programme board documented?',       platform: 'confluence' },
      { text: 'I inherited a RAID log that has not been maintained — should I migrate it into Jira or keep it in Confluence?',   platform: 'jira'       },
    ],
  },
  {
    category: 'sprint_ceremonies',
    label: 'Sprint ceremonies',
    weight: 4,
    questions: [
      { text: 'Where do I set up the sprint in Jira and how do I move stories into it during planning?',                        platform: 'jira'  },
      { text: 'Where in Confluence is the team agreement on who facilitates the retrospective documented?',                      platform: 'confluence' },
      { text: 'Is the daily stand-up run from the Jira board or does each team do it differently?',                             platform: 'jira'  },
      { text: 'If the demo environment is broken on sprint review day, which Slack channel should I post in to coordinate?',    platform: 'slack' },
      { text: 'Where in Jira do I cancel a sprint if scope changes significantly mid-sprint?',                                  platform: 'jira'  },
    ],
  },
  {
    category: 'delivery_metrics',
    label: 'Delivery metrics',
    weight: 3,
    questions: [
      { text: 'Where in Confluence are the metrics the programme board expects to see on a regular status report documented?',   platform: 'confluence' },
      { text: 'How is velocity calculated in Jira — story points, issue count, or something else?',                             platform: 'jira'       },
      { text: 'Is there a Jira dashboard I should be maintaining or do I compile the metrics manually?',                        platform: 'jira'       },
      { text: 'Where in Jira do I check the cycle time for a user story from start to done?',                                   platform: 'jira'       },
      { text: 'Who reviews the Jira metrics and how quickly do I need to act if something goes off track?',                     platform: 'jira'       },
    ],
  },
  {
    category: 'change_control',
    label: 'Change control',
    weight: 3,
    questions: [
      { text: 'Where in Confluence is the definition of what constitutes a change requiring formal change control documented?',  platform: 'confluence' },
      { text: 'How long does a Jira change request typically take to be approved and who has permission to approve it?',         platform: 'jira'       },
      { text: 'Is there an emergency change issue type in Jira for fixes that need to go live immediately?',                     platform: 'jira'       },
      { text: 'Where in Confluence is the change log and am I responsible for updating it after approval?',                      platform: 'confluence' },
      { text: 'If I implement a change without a Jira change request, where in Confluence is the policy on that documented?',    platform: 'confluence' },
    ],
  },
  {
    category: 'budget_tracking',
    label: 'Budget tracking',
    weight: 3,
    questions: [
      { text: 'Where in Confluence is the project budget page and what level of detail is tracked there?',                         platform: 'confluence' },
      { text: 'Is there a Confluence template for raising a budget amendment when I am forecasting an overrun?',                   platform: 'confluence' },
      { text: 'Where in Confluence is the required reconciliation cadence for actual spend versus forecast documented?',           platform: 'confluence' },
      { text: 'Which Slack channel should I use to request approval for an ad-hoc purchase that is not in the original budget?',   platform: 'slack'      },
      { text: 'Where in Confluence is the contingency reserve policy and the threshold for using it without further approval?',    platform: 'confluence' },
    ],
  },
  {
    category: 'resource_planning',
    label: 'Resource planning',
    weight: 2,
    questions: [
      { text: 'How do I request a resource from another team — is there a Jira ticket type or a Slack channel for that?',        platform: 'jira'       },
      { text: 'Where in Confluence is the resource capacity plan and how do I feed my project demand into it?',                  platform: 'confluence' },
      { text: 'If a resource is pulled from my project mid-delivery, which Slack channel should I use to escalate it?',          platform: 'slack'      },
      { text: 'Where in Confluence is the list of available contractors I can draw on if the internal team is at capacity?',     platform: 'confluence' },
      { text: 'How do I log a Jira issue if a team member allocated to my project is spending time on other work?',              platform: 'jira'       },
    ],
  },
  {
    category: 'status_reporting',
    label: 'Status reporting',
    weight: 2,
    questions: [
      { text: 'Where in Confluence is the reporting cadence for status reports and the expected audience documented?',                platform: 'confluence' },
      { text: 'Is there a Confluence template for the RAG status report or do I format it myself?',                                   platform: 'confluence' },
      { text: 'Where in Confluence is the difference between the programme board summary and the sponsor summary explained?',         platform: 'confluence' },
      { text: 'How far in advance do I need to submit a status report before a governance meeting — is it in the Confluence calendar?', platform: 'confluence' },
      { text: 'When I need to report a red status, should I post in the project Slack channel before the formal report?',             platform: 'slack'      },
    ],
  },
  {
    category: 'dependency_tracking',
    label: 'Dependency tracking',
    weight: 2,
    questions: [
      { text: 'How do I flag a cross-team dependency in Jira and get it acknowledged by the other PM?',                          platform: 'jira'       },
      { text: 'If a dependency I own slips, which Slack channel should I use to notify stakeholders and how quickly?',           platform: 'slack'      },
      { text: 'Is there a shared dependency register in Confluence at programme level or does each project maintain its own?',   platform: 'confluence' },
      { text: 'How do I raise a Jira issue to assign an owner to a dependency that currently has none?',                        platform: 'jira'       },
      { text: 'I have a hard external dependency on a third-party delivery — where in Jira do I record that as a risk?',        platform: 'jira'       },
    ],
  },
  {
    category: 'retrospectives',
    label: 'Retrospectives',
    weight: 1,
    questions: [
      { text: 'Do teams use Miro for retrospectives here or is there another tool?',                                              platform: 'miro'       },
      { text: 'Where in Confluence is the team agreement on who should attend the retrospective documented?',                     platform: 'confluence' },
      { text: 'How are retrospective actions tracked — do they go into Jira or somewhere else?',                                  platform: 'jira'       },
      { text: 'Where in Confluence should I post retrospective outcomes so the rest of the programme can see them?',              platform: 'confluence' },
      { text: 'Where in Confluence is the project closure checklist that includes when to hold the post-project retrospective?',  platform: 'confluence' },
    ],
  },
  {
    category: 'governance',
    label: 'Governance',
    weight: 1,
    questions: [
      { text: 'Where in Confluence is the governance framework that lists which boards my project needs to report to?',          platform: 'confluence' },
      { text: 'Where in Confluence is the project classification system that determines the level of governance oversight?',      platform: 'confluence' },
      { text: 'Where in Confluence do I find the gate review template and what artefacts does it need?',                         platform: 'confluence' },
      { text: 'Who chairs the steering committee and how do I request time on the agenda via Slack?',                            platform: 'slack'      },
      { text: 'Where in Confluence is the delivery lifecycle document that lists mandatory assurance reviews?',                   platform: 'confluence' },
    ],
  },
  {
    category: 'escalation',
    label: 'Escalation paths',
    weight: 1,
    questions: [
      { text: 'Where in Jira do I log a blocker escalation that I cannot resolve at project level?',                            platform: 'jira'       },
      { text: 'If two senior stakeholders give conflicting direction, which Slack channel should I use to escalate it?',        platform: 'slack'      },
      { text: 'Where in Confluence is the formal escalation matrix documented?',                                                platform: 'confluence' },
      { text: 'Where in Confluence is the SLA for how quickly an escalation must be resolved at programme level?',              platform: 'confluence' },
      { text: 'Where in Confluence should I log every escalation, even ones that get resolved informally?',                     platform: 'confluence' },
    ],
  },
]

/**
 * Build ALL user_questions rows for a team deterministically.
 *
 * Algorithm:
 *  1. Compute a team-wide question budget (TEAM_QUESTION_BUDGET).
 *  2. Allocate that budget across categories in proportion to their weights
 *     using a largest-remainder method so the parts sum exactly to the budget,
 *     with a floor of at least 2 per category so none is rounded away.
 *  3. Within each category, cycle through its questions in order so every
 *     question gets used rather than one repeating.
 *  4. Spread the resulting rows across the team members using PERSON_COUNTS,
 *     a fixed sequence whose values sum to TEAM_QUESTION_BUDGET and whose
 *     spread (6–10) looks natural.
 *
 * @param {Array}  teamMembers  — array of { userId, orgId, email, startOffset }
 * @param {string} orgId
 * @param {Array}  categories   — the team's category set
 * @returns {Array} rows ready to INSERT into user_questions
 */

/** Total questions per 15-person team.  Chosen so weight-5 categories get
 *  budget * (5/totalWeight) rows and weight-1 categories get budget * (1/totalWeight),
 *  yielding exactly a 5:1 ratio when totalWeight = 40.  At 120 the per-category
 *  exact shares are all whole numbers (no remainder pass needed), but the
 *  largest-remainder logic is included for robustness. */
const TEAM_QUESTION_BUDGET = 120

/** Per-person question counts for 15 people.  Values sum to TEAM_QUESTION_BUDGET (120).
 *  Range 6–10 makes per-person counts look natural. */
const PERSON_COUNTS = [6, 7, 9, 8, 10, 7, 8, 9, 6, 10, 8, 7, 9, 6, 10]

function buildTeamHeatmapRows(teamMembers, orgId, categories) {
  if (teamMembers.length === 0) return []

  // ── Step 1: allocate budget across categories ────────────────────────────
  const totalWeight = categories.reduce((s, c) => s + c.weight, 0)
  const FLOOR = 2

  // Exact fractional shares
  const exact = categories.map(c => (c.weight / totalWeight) * TEAM_QUESTION_BUDGET)

  // Floor each share (minimum FLOOR)
  const floors = exact.map(e => Math.max(FLOOR, Math.floor(e)))

  // Distribute any remaining budget using largest-remainder method
  let remaining = TEAM_QUESTION_BUDGET - floors.reduce((s, f) => s + f, 0)
  const remainders = exact.map((e, i) => ({ i, r: e - Math.floor(e) }))
  remainders.sort((a, b) => b.r - a.r)
  for (let k = 0; k < remaining; k++) {
    floors[remainders[k].i]++
  }

  // ── Step 2: build the flat ordered list of (category, questionIndex) pairs
  //    cycling through each category's questions in order ─────────────────
  const flatSlots = []   // each element: { cat, q }
  for (let ci = 0; ci < categories.length; ci++) {
    const cat   = categories[ci]
    const count = floors[ci]
    for (let k = 0; k < count; k++) {
      const q = cat.questions[k % cat.questions.length]
      flatSlots.push({ cat, q })
    }
  }

  // Shuffle the flat list with a deterministic Fisher-Yates so questions from
  // different categories are interleaved rather than arriving in one block.
  // Seed is stable (does not depend on any per-person value).
  let seed = 0x5f3759df
  function nextFloat() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    seed = seed >>> 0
    return seed / 0xffffffff
  }
  for (let i = flatSlots.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat() * (i + 1));
    [flatSlots[i], flatSlots[j]] = [flatSlots[j], flatSlots[i]]
  }

  // ── Step 3: assign slots to people using PERSON_COUNTS ──────────────────
  // Cycle PERSON_COUNTS if there are fewer or more than 15 members.
  const rows = []
  let slotIdx = 0

  for (let pi = 0; pi < teamMembers.length; pi++) {
    const member = teamMembers[pi]
    const count  = PERSON_COUNTS[pi % PERSON_COUNTS.length]
    for (let k = 0; k < count && slotIdx < flatSlots.length; k++, slotIdx++) {
      const { cat, q } = flatSlots[slotIdx]
      rows.push({
        org_id:         member.orgId,
        user_id:        member.userId,
        question:       q.text,
        category:       cat.category,
        category_label: cat.label,
        source_topic:   q.platform ?? null,
        asked_at:       randomPastWorkingTime(1, member.startOffset + 10),
      })
    }
  }

  return rows
}

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

// ─── Refresh-questions mode ────────────────────────────────────────────────────
//
// Runs immediately after supervisors are resolved — before job roles, task
// templates, quizzes, or any people-creation work.  Exits cleanly when done.

if (values['refresh-questions']) {
  section('Refresh-questions mode — updating asked-question rows for existing fake starters')

  // Find every fake starter currently in the DB by their email domain
  const { data: { users: allAuthUsers }, error: listErr2 } =
    await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr2) die('Failed to list auth users', listErr2)

  const fakeAuthUsers = allAuthUsers.filter(u => u.email?.endsWith(FAKE_DOMAIN))

  if (fakeAuthUsers.length === 0) {
    console.log('\nNo seeded fake starters found — nothing to refresh.')
    process.exit(0)
  }

  log(`Found ${fakeAuthUsers.length} fake starter(s) to refresh.`)

  // Build a supervisor-id → category-set map from the supervisors passed in
  const supervisorCategoryMap = new Map([
    [arda.id,  { name: 'Development',        categories: DEV_CATEGORIES }],
    [arman.id, { name: 'Project Management', categories: PM_CATEGORIES  }],
  ])
  if (benjamin) {
    supervisorCategoryMap.set(benjamin.id, { name: 'Project Management (2)', categories: PM_CATEGORIES })
  }

  // Fetch the profile row for every fake starter so we know their supervisor
  const fakeIds = fakeAuthUsers.map(u => u.id)
  const { data: fakeProfiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, supervisor_id, org_id')
    .in('id', fakeIds)
  if (profErr) die('Failed to fetch profiles for fake starters', profErr)

  // ── Pass 1: delete old rows and collect per-person data ───────────────────
  //
  // Group by team first so we can apply the coverage pass per team after all
  // people in that team have had their rows built.
  //
  // teamBuckets: teamName → { categories, members: [{ userId, orgId, email, startOffset, rows }] }
  const teamBuckets = new Map()

  let totalPeople  = 0
  let totalOldRows = 0

  // Fetch start_date for all fake starters in one query
  const { data: profileDetails, error: pdErr } = await supabase
    .from('profiles')
    .select('id, start_date')
    .in('id', fakeIds)
  if (pdErr) die('Failed to fetch start_dates for fake starters', pdErr)
  const startDateById = new Map((profileDetails ?? []).map(p => [p.id, p.start_date]))

  for (const profile of (fakeProfiles ?? [])) {
    const entry = supervisorCategoryMap.get(profile.supervisor_id)
    if (!entry) {
      log(`  ⚠ ${profile.full_name} — supervisor ${profile.supervisor_id} not in this run; skipping`)
      continue
    }

    const { name: teamName, categories } = entry

    const authUser   = fakeAuthUsers.find(u => u.id === profile.id)
    const email      = authUser?.email ?? profile.id
    const startDateMs = startDateById.get(profile.id)
      ? new Date(startDateById.get(profile.id)).getTime()
      : Date.now()
    const startOffset = Math.max(1, Math.round((Date.now() - startDateMs) / 86_400_000))

    // Delete old rows for this person
    const { count: deletedCount, error: delErr } = await supabase
      .from('user_questions')
      .delete({ count: 'exact' })
      .eq('user_id', profile.id)
    if (delErr) die(`Failed to delete question rows for ${email}`, delErr)

    totalOldRows += deletedCount ?? 0
    totalPeople++

    if (!teamBuckets.has(teamName)) {
      teamBuckets.set(teamName, { categories, members: [] })
    }
    teamBuckets.get(teamName).members.push({
      userId: profile.id, orgId: profile.org_id, email, startOffset,
    })

    log(`  ✓ ${profile.full_name} (${email}) — deleted old rows [${teamName}]`)
  }

  // ── Pass 2: deterministic team build + bulk insert ────────────────────────
  const teamTally  = new Map()
  let totalNewRows = 0

  for (const [teamName, { categories, members }] of teamBuckets) {
    const toInsert = buildTeamHeatmapRows(members, members[0]?.orgId ?? orgId, categories)

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('user_questions').insert(toInsert)
      if (insErr) die(`Failed to insert refreshed question rows for team "${teamName}"`, insErr)
    }

    teamTally.set(teamName, { people: members.length, newRows: toInsert.length })
    totalNewRows += toInsert.length
    log(`  ✓ Team "${teamName}": ${toInsert.length} rows written`)
  }

  console.log(`
─────────────────────────────────────────────────────
Refresh complete.

  People refreshed : ${totalPeople}
  Old rows removed : ${totalOldRows}
  New rows written : ${totalNewRows}

  Breakdown by team:`)
  for (const [name, t] of teamTally) {
    console.log(`    ${name}: ${t.people} person(s), ${t.newRows} rows written`)
  }
  console.log(`─────────────────────────────────────────────────────
`)
  process.exit(0)
}

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

async function createInterns(people, supervisor, roleId, templates, quizIds, questionMap, buckets, scoreProfiles, teamName, categories) {
  let created = 0
  let skipped = 0
  let assignmentsCreated = 0
  let answersCreated = 0

  // Collect team members for the bulk heatmap build after the loop.
  const heatmapMembers = []   // { userId, orgId, email, startOffset }

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

    // ── Collect this person for the team-level heatmap build ─────────────────
    heatmapMembers.push({ userId, orgId, email, startOffset: Math.abs(person.start) })

    log(`  ✓ ${person.first} ${person.last} (${email}) — bucket: ${bucket}`)
    created++
  }

  // ── Build and insert all heatmap rows for the team at once ────────────────
  const toInsert = buildTeamHeatmapRows(heatmapMembers, orgId, categories)

  if (toInsert.length > 0) {
    const { error: heatmapErr } = await supabase.from('user_questions').insert(toInsert)
    if (heatmapErr) die(`Failed to insert heatmap rows for team "${teamName}"`, heatmapErr)
  }

  return { created, skipped, assignmentsCreated, answersCreated }
}

const devResult = await createInterns(
  DEV_PEOPLE, arda,  devRoleId, devTemplates, devQuizIds, devQuestions,
  BUCKETS_DEV, SCORE_PROFILES_DEV, 'Development', DEV_CATEGORIES,
)

const pmResult = await createInterns(
  PM_PEOPLE, arman, pmRoleId, pmTemplates, pmQuizIds, pmQuestions,
  BUCKETS_PM, SCORE_PROFILES_PM, 'Project Management', PM_CATEGORIES,
)

let pm2Result = { created: 0, skipped: 0, assignmentsCreated: 0, answersCreated: 0 }
if (benjamin) {
  pm2Result = await createInterns(
    PM2_PEOPLE, benjamin, pmRoleId, pmTemplates, pmQuizIds, pmQuestions,
    BUCKETS_PM2, SCORE_PROFILES_PM2, 'Project Management', PM_CATEGORIES,
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
