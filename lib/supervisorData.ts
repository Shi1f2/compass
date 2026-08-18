/**
 * lib/supervisorData.ts
 * Question bank, roster and helpers for the supervisor landing page.
 * Nothing here is loaded or fetched — all handwritten.
 */

import type { Question, QuizResult } from './types'
import { NOT_ATTEMPTED } from './quizGroup'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PASS_THRESHOLD   = 80
export const MIN_QS_PER_DAY   = 4

// ─── Question bank ────────────────────────────────────────────────────────────

interface QTemplate {
  prompt:      string
  options:     [string, string, string]    // always three options a/b/c
  correctIdx:  0 | 1 | 2
  explanation: string
  altExplanation: string
  system:      string
}

const BANK: Record<string, QTemplate[]> = {
  'Meeting Brightfield & your team': [
    {
      prompt: 'Who is the best first contact for day-to-day questions about your work?',
      options: ['Your line manager', 'The HR helpdesk', 'The IT support queue'],
      correctIdx: 0,
      explanation: 'Your line manager is accountable for your onboarding and is the right person for day-to-day questions. HR and IT have specific remits and routing queries through them for general matters adds unnecessary delays.',
      altExplanation: 'Day-to-day guidance lives with your manager, not with specialist helpdesks. Those exist for their own domains — payroll, hardware — not for general orientation.',
      system: 'HRIS',
    },
    {
      prompt: 'Where is the formal reporting line for your role recorded?',
      options: ['Brightfield People under your employee profile', 'The shared team calendar', 'The project board'],
      correctIdx: 0,
      explanation: 'Brightfield People holds the authoritative org structure. Calendars and boards change frequently and are not a source of truth for line management.',
      altExplanation: 'The org chart in Brightfield People is the single source of truth — calendars and project boards are working tools, not HR records.',
      system: 'HRIS',
    },
    {
      prompt: 'What is the week-two onboarding review primarily for?',
      options: ['To check that setup tasks are complete and answer any questions', 'To set formal performance targets', 'To decide whether probation will pass'],
      correctIdx: 0,
      explanation: 'The week-two review is a practical check-in, not an evaluation. Performance targets and probation decisions come later in the programme.',
      altExplanation: 'Week two is still setup territory — the review is a health check and a Q&A, not an assessment. Probation conversations happen at month three.',
      system: 'HRIS',
    },
    {
      prompt: 'You notice a recurring meeting in your calendar that nobody has explained. What should you do?',
      options: ['Ask your manager what it is before attending or declining', 'Decline it — if it matters someone will re-invite you', 'Accept it and ask questions at the end'],
      correctIdx: 0,
      explanation: 'Asking your manager first means you understand the context before deciding whether to attend. Declining blindly risks missing something important; attending without context makes participation harder.',
      altExplanation: 'Always clarify before declining a mysterious meeting — it could be a standing cross-team sync that your role is expected in. Your manager can tell you in thirty seconds.',
      system: 'HRIS',
    },
  ],
  'Laptop, access and security setup': [
    {
      prompt: 'Your laptop arrives already enrolled in device management. What should you do first?',
      options: ['Complete the FileVault or BitLocker encryption setup and save the recovery key', 'Install your personal software preferences', 'Change the device name to something recognisable'],
      correctIdx: 0,
      explanation: 'Disk encryption is the security baseline — the device is managed but unencrypted until that step completes. Personal software and naming are lower priority and can follow.',
      altExplanation: 'Enrolment handles management; encryption is a separate step. Getting the recovery key stored safely is the first real task after unboxing.',
      system: 'ITSM',
    },
    {
      prompt: 'The overnight toolchain installation stalls at 60%. What is the right first step?',
      options: ['Raise a ticket in IT Support with a screenshot before trying anything else', 'Force-restart the laptop and run the installer again', 'Ask a colleague to share their working copy of the tools'],
      correctIdx: 0,
      explanation: 'Raising a ticket first creates a record and lets IT diagnose the failure from logs before anything is changed. A force-restart may lose diagnostic information and sharing tools bypasses security controls.',
      altExplanation: 'IT Support needs the failure state to help you. Acting first and asking later destroys the evidence. Always ticket before touching.',
      system: 'ITSM',
    },
    {
      prompt: "What actually makes a company laptop 'managed'?",
      options: ['Enrolment in device management plus disk encryption', 'The IT team paid for it', 'Having a company email account on it'],
      correctIdx: 0,
      explanation: 'A managed device is enrolled in the MDM platform and has encryption enabled. Who paid for the hardware and what accounts are on it are separate questions.',
      altExplanation: 'Ownership and management are different things. A device the company bought but never enrolled is unmanaged; a BYOD device enrolled in MDM is managed. The two factors are MDM enrolment and encryption.',
      system: 'ITSM',
    },
    {
      prompt: 'How is VPN access granted?',
      options: ['Automatically via your SSO credentials once your account is provisioned', 'By downloading the VPN client yourself from the vendor website', 'By emailing IT and asking for a licence'],
      correctIdx: 0,
      explanation: 'VPN access is tied to SSO provisioning — once your account is active the credentials work with the approved client. Downloading software outside the approved channel and emailing for licences both bypass the provisioning workflow.',
      altExplanation: 'SSO does the work here. Your credentials unlock the VPN once provisioning completes. No separate request or self-serve download is needed.',
      system: 'SSO',
    },
  ],
  'Leave, hours and benefits': [
    {
      prompt: 'How should you book annual leave?',
      options: ['Submit a request in Brightfield Expenses → Time Off at least five working days in advance', 'Email your manager directly and mark yourself out of office', 'Post in the team channel and block your calendar'],
      correctIdx: 0,
      explanation: 'Brightfield Expenses → Time Off is the system of record for leave. Email and calendar blocks do not trigger the approval workflow or update your entitlement balance.',
      altExplanation: 'The leave system exists precisely so that entitlement is tracked and managers get a formal notification. Informal routes do not satisfy HR compliance.',
      system: 'Expenses',
    },
    {
      prompt: 'Who approves a leave request of under five days, and what happens if they do not respond within two working days?',
      options: ['Your line manager approves; it is automatically approved after two working days of no response', 'HR approves all leave regardless of length', 'Leave under five days does not require approval'],
      correctIdx: 0,
      explanation: 'Line managers approve leave requests. The two-working-day automatic approval is a safeguard so that admin delays do not leave people in limbo — it is not an invitation to book without approval.',
      altExplanation: 'Short leave goes to your manager, not HR. The auto-approval fallback protects you from a non-responsive manager, but the expectation is still that you wait for an explicit answer where possible.',
      system: 'Expenses',
    },
    {
      prompt: 'What happens to unused annual leave at the end of the leave year?',
      options: ['Up to five days can be carried over with sign-off; the rest is forfeited, not paid', 'All unused leave is paid out automatically', 'You can carry over as much as you like with manager approval'],
      correctIdx: 0,
      explanation: 'The carry-over limit is five days with explicit sign-off; leave above that is forfeited rather than paid out. This is set by the company leave policy, not statutory minimum.',
      altExplanation: 'Carry-over is five days maximum, with sign-off required. Excess leave does not convert to pay — it disappears. Plan your leave accordingly.',
      system: 'HRIS',
    },
    {
      prompt: 'When must new starters complete benefits enrolment?',
      options: ['Within 30 days of the start date', 'At the end of the probation period', 'Any time in the first year'],
      correctIdx: 0,
      explanation: 'The 30-day window is a hard deadline. Missing it means waiting until the next open enrolment period, which may be months away.',
      altExplanation: 'Thirty days is the cut-off — after that the window closes until the next cycle. It is not a soft suggestion.',
      system: 'HRIS',
    },
  ],
  'Expenses and data handling': [
    {
      prompt: 'You need a second monitor. What is the correct route?',
      options: ['Raise a hardware request in Brightfield IT Support before purchasing anything', 'Buy it and submit an expense claim afterwards', 'Ask your manager to order it on their company card'],
      correctIdx: 0,
      explanation: 'Pre-approval via IT Support is required for hardware. Buying first and claiming back is not guaranteed to be reimbursed and bypasses the asset tracking workflow.',
      altExplanation: 'Hardware claims without prior approval are routinely rejected. The ticket route also ensures the asset is registered, which matters for insurance and security.',
      system: 'ITSM',
    },
    {
      prompt: 'May you save company documents to your personal laptop?',
      options: ['No — company documents must stay on managed devices or approved cloud storage', 'Yes, as long as you do not share them externally', 'Yes, if your manager verbally approves it'],
      correctIdx: 0,
      explanation: 'Company documents on unmanaged personal devices are outside IT\'s control and breach the data handling policy regardless of intent or verbal approval.',
      altExplanation: 'An unmanaged device means no encryption guarantee, no remote wipe, and no audit trail. The policy is clear: company data stays on managed devices.',
      system: 'Docs',
    },
    {
      prompt: 'You submit a £90 expense claim. What happens?',
      options: ['It self-approves — the threshold for manager approval is £150', 'It is sent to your manager for approval', 'It is sent to finance for approval'],
      correctIdx: 0,
      explanation: 'Claims under £150 self-approve in Brightfield Expenses. Manager and finance approval only kick in above that threshold.',
      altExplanation: 'The self-approval threshold is £150. A £90 claim clears it automatically — no manager needs to see it.',
      system: 'Expenses',
    },
    {
      prompt: 'You submit a £240 expense claim. What is different?',
      options: ['It routes to your manager for approval before it can be paid', 'It self-approves like any other claim', 'It requires a receipt scan before submission'],
      correctIdx: 0,
      explanation: 'Claims at or above £150 require manager sign-off. £240 exceeds the threshold, so it sits in the approval queue until your manager acts.',
      altExplanation: 'Over £150 means manager involvement. The receipt is always good practice but does not change the approval routing.',
      system: 'Expenses',
    },
  ],
  'Spotting and reporting security issues': [
    {
      prompt: 'You receive an email asking you to reset your Brightfield password via a link. What should you do?',
      options: ['Report it to IT Support via #it-support without clicking anything', 'Click the link to check whether it is real', 'Delete it and carry on'],
      correctIdx: 0,
      explanation: 'Brightfield IT never sends unsolicited password-reset emails. Reporting it before clicking anything lets IT block the campaign for everyone. Deleting it without reporting means the phishing run continues unchallenged.',
      altExplanation: 'The correct move is always report before act. Even a link that looks legitimate may execute on hover. One Slack message to #it-support costs nothing and protects the whole organisation.',
      system: 'ITSM',
    },
    {
      prompt: 'What is the bar for reporting a suspicious message to IT Security?',
      options: ['Suspicion — you do not need to be certain it is malicious', 'Certainty — only report if you are sure it is an attack', 'Only if you clicked a link or gave any details'],
      correctIdx: 0,
      explanation: 'Reporting on suspicion is the right standard. False positives are cheap; false negatives can be costly. IT Security is set up to evaluate reports quickly.',
      altExplanation: 'Waiting for certainty before reporting defeats the purpose of early detection. The cost of a wrong report is a brief investigation; the cost of a missed report can be much higher.',
      system: 'ITSM',
    },
    {
      prompt: 'Why should you not delete a suspicious email after reporting it?',
      options: ['IT Security may need to examine the original headers and attachments', 'Deleted emails still reach the IT inbox automatically', 'Deleting it counts as a security incident'],
      correctIdx: 0,
      explanation: 'Original email headers and any attachments carry forensic information that helps IT trace the campaign. Deleting the email destroys that evidence.',
      altExplanation: 'The headers are the evidence. Once deleted, IT cannot fully investigate or block the sending infrastructure. Report and leave it in place.',
      system: 'ITSM',
    },
    {
      prompt: 'IT sends you a message asking for your Brightfield password to fix a technical issue. What should you do?',
      options: ['Decline — legitimate IT staff never ask for passwords', 'Share it — IT need it to do their job', 'Share it only if it is via the official IT Support channel'],
      correctIdx: 0,
      explanation: 'Legitimate IT staff have administrative access and never need your password. Any request for a password is a social engineering attempt regardless of the channel it arrives on.',
      altExplanation: 'No real IT engineer needs your password. Admin tools grant system access without it. A password request, wherever it comes from, is always a red flag.',
      system: 'SSO',
    },
  ],
  'Requesting extra equipment': [
    {
      prompt: 'What is the correct route for requesting additional equipment?',
      options: ['Raise a ticket in Brightfield IT Support', 'Submit an expense claim for the purchase', 'Ask your manager to email IT on your behalf'],
      correctIdx: 0,
      explanation: 'IT Support is the single channel for hardware requests. Expense claims require prior approval, and routing through a manager adds delay without any procedural benefit.',
      altExplanation: 'The ticket route creates the asset record and the approval trail. Everything else is a workaround that creates gaps.',
      system: 'ITSM',
    },
    {
      prompt: 'Where does approved hardware come from?',
      options: ['IT procures it from the approved supplier list', 'You buy it yourself and claim it back', 'The office manager orders it from any supplier'],
      correctIdx: 0,
      explanation: 'Approved suppliers ensure the equipment meets security and compatibility requirements. Self-procurement bypasses those checks and is not guaranteed to be reimbursed.',
      altExplanation: 'The approved supplier list exists because IT needs to certify that equipment meets the company\'s security baseline before it joins the network.',
      system: 'ITSM',
    },
    {
      prompt: 'An approved hardware request has been sitting open for four days with no movement. What should you do?',
      options: ['Comment on the existing ticket asking for an update', 'Raise a second ticket to escalate', 'Buy the item yourself and expense it'],
      correctIdx: 0,
      explanation: 'Commenting on the existing ticket keeps all context in one place and notifies the assignee. A second ticket duplicates the request and can confuse triage. Self-purchasing is a last resort requiring manager pre-authorisation.',
      altExplanation: 'One ticket, one thread. Duplicates split the context and slow resolution. A comment is the right escalation; a second ticket is noise.',
      system: 'ITSM',
    },
    {
      prompt: 'Does the same IT Support ticket process apply to software licences?',
      options: ['Yes — software requests go through IT Support just like hardware', 'No — software can be downloaded and self-installed from the vendor website', 'Only for software over a certain price threshold'],
      correctIdx: 0,
      explanation: 'Software must be approved and installed through IT Support to ensure licence compliance and avoid introducing unvetted applications to the corporate network.',
      altExplanation: 'Self-installed software is a compliance and security risk even when it is legitimate. The approval process catches licence conflicts and ensures the app is on the approved list.',
      system: 'ITSM',
    },
  ],
  'Project tools and comms': [
    {
      prompt: 'A client has a question that touches your project. Which channel should you post it in?',
      options: ["The project's dedicated Slack channel, so the right people see it", 'Your manager\'s direct messages', 'The general company channel'],
      correctIdx: 0,
      explanation: 'Project channels are where the relevant team and client context lives. Direct messages to a manager create a bottleneck and lose the history; the general channel surfaces it to people with no context.',
      altExplanation: 'The project channel is the right level of specificity. It reaches the people with context without creating noise for everyone else.',
      system: 'Comms',
    },
    {
      prompt: 'Where is a project\'s Slack channel linked from?',
      options: ['The project page in Brightfield Projects', 'The company-wide Slack channel list', 'The IT Support ticket for the project'],
      correctIdx: 0,
      explanation: 'Brightfield Projects is the canonical home for each project. The channel link lives there so new joiners can find it without searching Slack.',
      altExplanation: 'Searching Slack for project channels is unreliable because naming conventions vary. The project page always has the correct link.',
      system: 'Project',
    },
    {
      prompt: "What does a task in the 'Needs sign-off' column mean?",
      options: ['The work is done and is waiting for a reviewer to approve it before it moves forward', 'The work has been reviewed and rejected', 'The task has been paused pending more information'],
      correctIdx: 0,
      explanation: 'Needs sign-off means the work is complete from the assignee\'s perspective and is blocked on a reviewer. It is not a rejection or a pause — it is a handoff.',
      altExplanation: 'Sign-off columns are a handoff point, not a failure state. The work is done; it just needs another pair of eyes before it progresses.',
      system: 'Project',
    },
    {
      prompt: 'You have finished a piece of work but nobody has reviewed it. What should you do?',
      options: ['Move it to Needs sign-off and post in the project channel to notify the reviewer', 'Wait for someone to notice it is done', 'Mark it as complete yourself'],
      correctIdx: 0,
      explanation: 'Moving the task and posting in the channel closes the loop — the reviewer gets a notification and the board reflects reality. Waiting passively or marking it complete yourself both stall the project unnecessarily.',
      altExplanation: 'Finished work sitting unreviewed is a delivery risk. The move-and-post pattern is the handoff — do not assume someone is watching the board.',
      system: 'Project',
    },
  ],
  'Contract review and sign-off': [
    {
      prompt: 'How should you prepare for the 90-day review?',
      options: ['Review the onboarding checklist and note any incomplete or in-progress items', 'Wait for your manager to send an agenda', 'Prepare a list of new responsibilities you want to take on'],
      correctIdx: 0,
      explanation: 'The checklist is the shared reference for what was expected. Coming to the review with a clear picture of what is done and what is not gives the conversation a concrete foundation.',
      altExplanation: 'The review is structured around the onboarding plan. Reviewing the checklist beforehand means you are contributing to the conversation rather than just responding to it.',
      system: 'HRIS',
    },
    {
      prompt: 'Who runs the 90-day review?',
      options: ['Your line manager', 'HR', 'A neutral skip-level manager'],
      correctIdx: 0,
      explanation: 'The 90-day review is a line-management conversation. HR may be involved in confirming probation outcomes but does not typically run the review itself.',
      altExplanation: 'This is a manager-led check-in, not an HR process. HR gets notified of the outcome; they do not chair the meeting.',
      system: 'HRIS',
    },
    {
      prompt: 'What should you bring to the review?',
      options: ['Any questions, any blockers and a self-assessment against the onboarding goals', 'A signed copy of your employment contract', 'A list of training courses you want to attend'],
      correctIdx: 0,
      explanation: 'Self-assessment and open questions make the review a two-way conversation. Contract documents and training requests are separate processes.',
      altExplanation: 'Come prepared to talk about where you are on the onboarding goals and what you still need. Training and contract questions have their own channels.',
      system: 'HRIS',
    },
    {
      prompt: 'What happens to the onboarding checklist after the 90-day review?',
      options: ['It stays on file as the compliance record of completed onboarding', 'It is deleted once probation is confirmed', 'It is returned to the new starter'],
      correctIdx: 0,
      explanation: 'The checklist becomes a compliance record. It stays in Brightfield as evidence that onboarding requirements were completed, which matters for audits and regulatory checks.',
      altExplanation: 'Once complete, the checklist is an audit artefact. It does not disappear — it moves to the compliance record store where it can be retrieved for audits.',
      system: 'Docs',
    },
  ],
}

// Development-only assertion: a day is built from a topic's whole bank, so a
// thin bank would silently produce a thin day. This fails loudly instead.
if (process.env.NODE_ENV === 'development') {
  for (const [topic, templates] of Object.entries(BANK)) {
    if (templates.length < MIN_QS_PER_DAY) {
      throw new Error(
        `Question bank for "${topic}" has only ${templates.length} template(s); minimum is ${MIN_QS_PER_DAY}.`
      )
    }
  }
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_HIGHLIGHT = { x: 0.30, y: 0.34, width: 0.40, height: 0.20, label: 'region' }
const STUB_SCENE     = { view: 'quiz' as const, sidebarIndex: 6, rowIndex: -1 }

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function parseDate(s: string): Date {
  const [d, mon, y] = s.split(' ')
  const m = MONTHS.indexOf(mon ?? '')
  return new Date(Number(y), m, Number(d))
}

function attemptDate(startDate: string, dayNum: number): string {
  const d = parseDate(startDate)
  d.setDate(d.getDate() + dayNum - 1)
  const h = 9 + (dayNum % 3)
  const min = String((dayNum * 7) % 60).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]!} ${d.getFullYear()}, ${h}:${min}`
}

// ─── Question builder ─────────────────────────────────────────────────────────

function buildQuestion(
  id: string,
  day: number,
  topicLabel: string,
  template: QTemplate,
  chosenIdx?: 0 | 1 | 2,
  when?: string,
): Question {
  const optIds = ['a', 'b', 'c'] as const
  const options = template.options.map((text, i) => ({ id: optIds[i]!, text }))
  const correctId = optIds[template.correctIdx]!
  const chosenId  = chosenIdx !== undefined ? optIds[chosenIdx]! : undefined
  const attempted = chosenId !== undefined && when !== undefined

  const result: QuizResult = {
    chosenOptionId:  chosenId  ?? '',
    correct:         attempted ? chosenId === correctId : false,
    score:           attempted ? (chosenId === correctId ? 100 : 0) : 0,
    attemptedAt:     attempted ? when! : NOT_ATTEMPTED,
    passThreshold:   PASS_THRESHOLD,
    acknowledgement: attempted && chosenId === correctId ? `Confirmed understanding of the topic.` : '',
  }

  return {
    id,
    dayLabel:        topicLabel,
    prompt:          template.prompt,
    system:          template.system as Question['system'],
    options,
    correctOptionId: correctId,
    explanation:     template.explanation,
    altExplanation:  template.altExplanation,
    highlight:       { ...STUB_HIGHLIGHT },
    scene:           { ...STUB_SCENE },
    start:           day,
    end:             day + 1,
    points:          10,
    result,
  }
}

// ─── Quiz builder ─────────────────────────────────────────────────────────────

type DayEntry = {
  day:       number
  topic:     string
  // Choices array maps to bank questions in order.
  // Omitting it entirely leaves every question unattempted (day reads as locked).
  // A short array leaves the remainder unattempted (day reads as in progress).
  choices?:  (0 | 1 | 2 | null)[]
}

function buildQuiz(prefix: string, startDate: string, entries: DayEntry[]): Question[] {
  const questions: Question[] = []
  for (const entry of entries) {
    const templates = BANK[entry.topic] ?? []
    templates.forEach((tpl, qi) => {
      const chosenIdx = entry.choices?.[qi]
      const id        = `${prefix}-d${entry.day}-q${qi}`
      const when      = (chosenIdx !== null && chosenIdx !== undefined)
        ? attemptDate(startDate, entry.day)
        : undefined
      questions.push(buildQuestion(
        id, entry.day, entry.topic, tpl,
        (chosenIdx !== null && chosenIdx !== undefined) ? chosenIdx : undefined,
        when,
      ))
    })
  }
  return questions
}

// ─── Checklist model ──────────────────────────────────────────────────────────

/**
 * Setup and knowledge are two separate dimensions on purpose. A person can be
 * fully set up administratively and still weak on the quiz, or scoring well on
 * the quiz while blocked waiting on IT. They are never collapsed into one number.
 * In production these items would come from the connected systems over MCP; here
 * they are a mock array. The last-reported date is always present; the waiting
 * count is only meaningful while waiting; and the knowledge flag ties the
 * checklist to the quiz.
 */
export type ChecklistSystem = 'ITSM' | 'HRIS' | 'Docs' | 'Project' | 'Device'
export type ChecklistState  = 'done' | 'waiting' | 'not-started'

export interface ChecklistItem {
  id:           string
  label:        string
  system:       ChecklistSystem
  state:        ChecklistState
  lastReported: string
  waitingDays?: number
  hasKnowledge: boolean
}

let _itemCounter = 0
function item(
  label: string,
  system: ChecklistSystem,
  state: ChecklistState,
  lastReported: string,
  hasKnowledge = false,
  waitingDays?: number,
): ChecklistItem {
  return {
    id: `ci-${++_itemCounter}`,
    label, system, state, lastReported, hasKnowledge, waitingDays,
  }
}

// ─── Roster ───────────────────────────────────────────────────────────────────

export interface Starter {
  id:         string
  name:       string
  initials:   string
  jobTitle:   string
  team:       string
  startDate:  string
  currentDay: number
  totalDays:  number
  quiz:       Question[]
  checklist:  ChecklistItem[]
}

// Paces deliberately mixed so the grid looks alive — a couple nearly done,
// several mid-programme, one on day one, one clearly struggling.
export const ROSTER: Starter[] = [
  // ── Olivia Bennett — almost done, all good ────────────────────────────────
  {
    id: 'ob', name: 'Olivia Bennett', initials: 'OB',
    jobTitle: 'Senior Backend Engineer', team: 'Platform Engineering',
    startDate: '6 Jul 2026', currentDay: 27, totalDays: 30,
    quiz: buildQuiz('ob', '6 Jul 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [0, 0, 0, 0] },
      { day: 14, topic: 'Expenses and data handling',         choices: [0, 0, 0, 0] },
      { day: 18, topic: 'Spotting and reporting security issues', choices: [0, 0, 0, 0] },
      { day: 22, topic: 'Requesting extra equipment',         choices: [0, 0, 0, 0] },
      { day: 25, topic: 'Project tools and comms',            choices: [0, 0, 0, 0] },
      { day: 27, topic: 'Contract review and sign-off',       choices: [0, 0, 0, 0] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done', '7 Jul 2026', true),
      item('Set up VPN access',            'ITSM',    'done', '7 Jul 2026'),
      item('Acknowledge employee handbook', 'Docs',   'done', '8 Jul 2026', true),
      item('Enrol in benefits',            'HRIS',    'done', '9 Jul 2026'),
      item('Join engineering project board','Project','done', '10 Jul 2026'),
      item('Complete security training',   'Docs',    'done', '12 Jul 2026', true),
      item('Ship first deploy',            'Project', 'done', '20 Jul 2026'),
    ],
  },

  // ── Thomas Ellery — good quiz, blocked on setup ──────────────────────────
  {
    id: 'te', name: 'Thomas Ellery', initials: 'TE',
    jobTitle: 'DevOps Engineer', team: 'Platform Engineering',
    startDate: '13 Jul 2026', currentDay: 24, totalDays: 30,
    quiz: buildQuiz('te', '13 Jul 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [0, 0, 0, 0] },
      { day: 14, topic: 'Expenses and data handling',         choices: [0, 0, 0, 0] },
      { day: 18, topic: 'Spotting and reporting security issues', choices: [0, 0, 0, 0] },
      { day: 22, topic: 'Requesting extra equipment',         choices: [0, 0, 0, 0] },
      { day: 24, topic: 'Project tools and comms',            choices: [0, 0, 0, 0] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done',    '14 Jul 2026', true),
      item('Set up VPN access',            'ITSM',    'waiting', '14 Jul 2026', false, 4),
      item('Acknowledge employee handbook', 'Docs',   'done',    '15 Jul 2026', true),
      item('Enrol in benefits',            'HRIS',    'done',    '16 Jul 2026'),
      item('Join engineering project board','Project','not-started','13 Jul 2026'),
      item('Complete security training',   'Docs',    'done',    '18 Jul 2026', true),
    ],
  },

  // ── Sophie Marlow — mid-programme ─────────────────────────────────────────
  {
    id: 'sm', name: 'Sophie Marlow', initials: 'SM',
    jobTitle: 'Product Analyst', team: 'Product & Insights',
    startDate: '20 Jul 2026', currentDay: 16, totalDays: 30,
    quiz: buildQuiz('sm', '20 Jul 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [0, 0, 0, 0] },
      { day: 14, topic: 'Expenses and data handling',         choices: [0, 0, 0, 0] },
      { day: 16, topic: 'Spotting and reporting security issues', choices: [0, 0] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done',    '21 Jul 2026', true),
      item('Set up VPN access',            'ITSM',    'done',    '21 Jul 2026'),
      item('Acknowledge employee handbook', 'Docs',   'done',    '22 Jul 2026', true),
      item('Enrol in benefits',            'HRIS',    'done',    '23 Jul 2026'),
      item('Access reporting dashboards',  'Project', 'done',    '25 Jul 2026'),
      item('Complete data handling training','Docs',  'waiting', '20 Jul 2026', true, 3),
    ],
  },

  // ── Grace Okonkwo — mid-programme, handbook + project board not started ──
  {
    id: 'go', name: 'Grace Okonkwo', initials: 'GO',
    jobTitle: 'Data Engineer', team: 'Platform Engineering',
    startDate: '20 Jul 2026', currentDay: 14, totalDays: 30,
    quiz: buildQuiz('go', '20 Jul 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [0, 0, 0, 0] },
      { day: 14, topic: 'Expenses and data handling',         choices: [0, 0] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done',       '21 Jul 2026', true),
      item('Set up VPN access',            'ITSM',    'done',       '21 Jul 2026'),
      item('Acknowledge employee handbook', 'Docs',   'not-started','20 Jul 2026', true),
      item('Enrol in benefits',            'HRIS',    'done',       '23 Jul 2026'),
      item('Join engineering project board','Project','waiting',    '20 Jul 2026', false, 2),
      item('Complete security training',   'Docs',    'not-started','20 Jul 2026', true),
    ],
  },

  // ── Aaron Chetwood — early, progressing steadily ─────────────────────────
  {
    id: 'ac', name: 'Aaron Chetwood', initials: 'AC',
    jobTitle: 'QA Engineer', team: 'Quality Assurance',
    startDate: '27 Jul 2026', currentDay: 11, totalDays: 30,
    quiz: buildQuiz('ac', '27 Jul 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [0, 0] },
      { day: 11, topic: 'Expenses and data handling',         choices: [] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done', '28 Jul 2026', true),
      item('Set up VPN access',            'ITSM',    'done',       '28 Jul 2026'),
      item('Acknowledge employee handbook', 'Docs',   'done',       '29 Jul 2026', true),
      item('Enrol in benefits',            'HRIS',    'waiting',    '27 Jul 2026', false, 2),
      item('Complete security training',   'Docs',    'not-started','27 Jul 2026', true),
    ],
  },

  // ── Liam Fairweather — early, tool access waiting ─────────────────────────
  {
    id: 'lf', name: 'Liam Fairweather', initials: 'LF',
    jobTitle: 'Support Engineer', team: 'Customer Support',
    startDate: '3 Aug 2026', currentDay: 9, totalDays: 30,
    quiz: buildQuiz('lf', '3 Aug 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [0, 0, 0, 0] },
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [0, 0, 0, 0] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done',    '4 Aug 2026', true),
      item('Set up VPN access',            'ITSM',    'done',    '4 Aug 2026'),
      item('Acknowledge employee handbook', 'Docs',   'done',    '5 Aug 2026', true),
      item('Support queue tool access',    'ITSM',    'waiting', '3 Aug 2026', false, 1),
      item('Complete security training',   'Docs',    'not-started','3 Aug 2026', true),
    ],
  },

  // ── Ella Whitmore — day one, nothing started ──────────────────────────────
  {
    id: 'ew', name: 'Ella Whitmore', initials: 'EW',
    jobTitle: 'Marketing Coordinator', team: 'Brand & Comms',
    startDate: '10 Aug 2026', currentDay: 1, totalDays: 30,
    quiz: buildQuiz('ew', '10 Aug 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team'    },
      { day: 5,  topic: 'Laptop, access and security setup'  },
      { day: 9,  topic: 'Leave, hours and benefits'          },
      { day: 14, topic: 'Expenses and data handling'         },
      { day: 18, topic: 'Spotting and reporting security issues' },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'not-started', '10 Aug 2026', true),
      item('Set up VPN access',            'ITSM',    'not-started', '10 Aug 2026'),
      item('Acknowledge employee handbook', 'Docs',   'not-started', '10 Aug 2026', true),
      item('Enrol in benefits',            'HRIS',    'not-started', '10 Aug 2026'),
      item('Brand asset library access',   'Project', 'not-started', '10 Aug 2026'),
    ],
  },

  // ── Daniel Iqbal — all done on setup; quiz average well below pass.
  // This is exactly the contrast the two dimensions exist to show.
  {
    id: 'di', name: 'Daniel Iqbal', initials: 'DI',
    jobTitle: 'Financial Analyst', team: 'Finance',
    startDate: '22 Jun 2026', currentDay: 19, totalDays: 30,
    quiz: buildQuiz('di', '22 Jun 2026', [
      { day: 3,  topic: 'Meeting Brightfield & your team',    choices: [2, 1, 2, 1] },  // wrong answers
      { day: 5,  topic: 'Laptop, access and security setup',  choices: [1, 2, 1, 2] },
      { day: 9,  topic: 'Leave, hours and benefits',          choices: [1, 0, 2, 1] },  // one right
      { day: 14, topic: 'Expenses and data handling',         choices: [2, 1, 2, 1] },
      { day: 18, topic: 'Spotting and reporting security issues', choices: [1, 2, 1, 2] },
    ]),
    checklist: [
      item('Enrol laptop in device management (FileVault)', 'Device', 'done', '23 Jun 2026', true),
      item('Set up VPN access',            'ITSM',    'done', '23 Jun 2026'),
      item('Acknowledge employee handbook', 'Docs',   'done', '24 Jun 2026', true),
      item('Enrol in benefits',            'HRIS',    'done', '25 Jun 2026'),
      item('Access reporting dashboards',  'Project', 'done', '27 Jun 2026'),
      item('Complete data handling training','Docs',  'done', '30 Jun 2026', true),
    ],
  },
]

// ─── Derived stats ────────────────────────────────────────────────────────────

export function answeredCount(s: Starter): number {
  return s.quiz.filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED).length
}

export function averageScore(s: Starter): number | null {
  const scores = s.quiz
    .filter(q => q.result && q.result.attemptedAt !== NOT_ATTEMPTED)
    .map(q => q.result!.score)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

export function completionPct(s: Starter): number {
  return Math.min(100, Math.round((s.currentDay / s.totalDays) * 100))
}

// Private helpers
function doneCount(s: Starter)          { return s.checklist.filter(c => c.state === 'done').length }
function setupPct(s: Starter): number   { return s.checklist.length ? Math.round((doneCount(s) / s.checklist.length) * 100) : 0 }
function knowledgePct(s: Starter): number {
  const attempted = answeredCount(s)
  return s.quiz.length ? Math.round((attempted / s.quiz.length) * 100) : 0
}

export { doneCount, setupPct, knowledgePct }

// ─── Checklist role bank ──────────────────────────────────────────────────────

/**
 * The point is to make role differences real rather than cosmetic.
 * A contractor gets BitLocker instead of FileVault, no benefits item, and a
 * contract-end-date item no other role has.
 */
export type InviteRole = 'Engineer' | 'Analyst' | 'Contractor' | 'Support' | 'Marketing'

export interface InviteChecklistItem {
  id:           string
  label:        string
  system:       ChecklistSystem
  included:     boolean
  hasKnowledge: boolean
}

let _inviteCounter = 0
function invItem(
  label: string,
  system: ChecklistSystem,
  included: boolean,
  hasKnowledge = false,
): InviteChecklistItem {
  return { id: `inv-${++_inviteCounter}`, label, system, included, hasKnowledge }
}

export const ROLE_CHECKLISTS: Record<InviteRole, InviteChecklistItem[]> = {
  Engineer: [
    invItem('Enrol laptop in device management (FileVault)', 'Device', true,  true),
    invItem('Set up VPN access',                             'ITSM',   true),
    invItem('Acknowledge employee handbook',                 'Docs',   true,  true),
    invItem('Enrol in benefits',                             'HRIS',   true),
    invItem('Join engineering project board',                'Project',true),
    invItem('Complete security training',                    'Docs',   true,  true),
    invItem('Ship first deploy',                             'Project',false),
  ],
  Analyst: [
    invItem('Enrol laptop in device management (FileVault)', 'Device', true,  true),
    invItem('Set up VPN access',                             'ITSM',   true),
    invItem('Acknowledge employee handbook',                 'Docs',   true,  true),
    invItem('Enrol in benefits',                             'HRIS',   true),
    invItem('Access reporting dashboards',                   'Project',true),
    invItem('Complete data handling training',               'Docs',   true,  true),
  ],
  Contractor: [
    invItem('Enrol laptop in device management (BitLocker)', 'Device', true,  true),
    invItem('Set up VPN access',                             'ITSM',   true),
    invItem('Acknowledge contractor handbook',               'Docs',   true,  true),
    invItem('Complete security training',                    'Docs',   true,  true),
    invItem('Note contract end date for IT reclaim',         'ITSM',   true),
  ],
  Support: [
    invItem('Enrol laptop in device management (FileVault)', 'Device', true,  true),
    invItem('Set up VPN access',                             'ITSM',   true),
    invItem('Acknowledge employee handbook',                 'Docs',   true,  true),
    invItem('Enrol in benefits',                             'HRIS',   true),
    invItem('Support queue tool access',                     'ITSM',   true),
    invItem('Complete security training',                    'Docs',   true,  true),
  ],
  Marketing: [
    invItem('Enrol laptop in device management (FileVault)', 'Device', true,  true),
    invItem('Set up VPN access',                             'ITSM',   true),
    invItem('Acknowledge employee handbook',                 'Docs',   true,  true),
    invItem('Enrol in benefits',                             'HRIS',   true),
    invItem('Brand asset library access',                    'Project',true),
    invItem('Complete security training',                    'Docs',   true,  true),
  ],
}
