/**
 * lib/data.ts
 * Hardcoded seed data for both demo profiles.
 * No network, no storage, no computation — everything is written by hand.
 * British English throughout.
 */

import type {
  Highlight, Note, NoteKind, Profile,
  Question, QuizOption, QuizResult, Scene, SourceSystem,
  SpecItem, SystemsMeta, Topic,
} from './types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const NO_NOTE: Note = { kind: 'none', text: '' }
const tip  = (text: string): Note => ({ kind: 'tip',     text })
const warn = (text: string): Note => ({ kind: 'warning', text })

function scene(view: Scene['view'], overrides: Partial<Scene> = {}): Scene {
  return {
    view,
    sidebarIndex: 0,
    rowIndex: -1,
    ...overrides,
  }
}

function stampDay(
  day: number,
  topicLabel: string,
  questions: Omit<Question, 'start' | 'end' | 'dayLabel'>[],
): Question[] {
  return questions.map(q => ({ ...q, start: day, end: day + 1, dayLabel: topicLabel }))
}

// ─── Highlight presets ────────────────────────────────────────────────────────

const H = {
  itsmRow0:      { x: 0.204, y: 0.163, width: 0.775, height: 0.04,  label: 'ticket' }        as Highlight,
  itsmRow1:      { x: 0.204, y: 0.203, width: 0.775, height: 0.04,  label: 'ticket' }        as Highlight,
  itsmRow2:      { x: 0.204, y: 0.243, width: 0.775, height: 0.04,  label: 'ticket' }        as Highlight,
  itsmDetail:    { x: 0.204, y: 0.313, width: 0.775, height: 0.133, label: 'ticket detail' } as Highlight,
  hrisCard:      { x: 0.204, y: 0.163, width: 0.263, height: 0.367, label: 'employee record' } as Highlight,
  hrisRow: (i: number): Highlight => ({ x: 0.483, y: (132 + 30 * i) / 600, width: 0.454, height: 0.043, label: 'record field' }),
  docsIntro:     { x: 0.204, y: 0.207, width: 0.775, height: 0.153, label: 'article' }       as Highlight,
  docsCallout:   { x: 0.229, y: 0.557, width: 0.725, height: 0.153, label: 'policy note' }   as Highlight,
  expenseFields: { x: 0.229, y: 0.23,  width: 0.725, height: 0.15,  label: 'claim form' }    as Highlight,
  expenseLimit:  { x: 0.229, y: 0.47,  width: 0.725, height: 0.093, label: 'approval limit' } as Highlight,
  projectCard: (col: number): Highlight => ({ x: 0.204 + 0.201 * col, y: 0.213, width: 0.168, height: 0.09, label: 'task card' }),
  commsReply:    { x: 0.563, y: 0.417, width: 0.354, height: 0.107, label: 'Compass reply' } as Highlight,
  quizPrompt:    { x: 0.346, y: 0.31,  width: 0.492, height: 0.093, label: 'question' }      as Highlight,
  quizOption: (i: number): Highlight => ({ x: 0.346, y: (254 + 46 * i) / 600, width: 0.492, height: 0.06, label: 'answer' }),
}


// ─── Priya's topics ───────────────────────────────────────────────────────────

const priyaTopics: Topic[] = [
  {
    id: 'ps-01',
    title: 'How do I get my laptop set up?',
    answer: 'Your MacBook Pro is shipped from the IT depot to your home address before day one. Open ticket IT-4471 in the IT Support queue on Brightfield to confirm delivery and collect your FileVault recovery key. The onboarding checklist in Brightfield People walks you through Jamf enrolment, setting up the corporate certificate, and joining the VPN.',
    altAnswer: 'IT sends your MacBook Pro directly to your home address so it arrives on or before day one. Raise ticket IT-4471 in the IT Support queue to confirm receipt and retrieve your FileVault recovery key. Brightfield People holds the full device-setup checklist covering Jamf, the corporate certificate and VPN.',
    detail: 'Device provisioning is managed through the IT Support queue in Brightfield. The MacBook is enrolled in Jamf MDM; the setup checklist lives under Brightfield People → Onboarding.',
    start: 0, end: 1,
    system: 'ITSM',
    highlight: H.itsmRow0,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 0, typedText: 'Priya Shah' }),
    note: tip('FileVault encrypts the disk automatically on first login. Keep your recovery key somewhere safe outside the laptop itself.'),
    scopedNote: "Marcus's device is a Windows laptop with BitLocker instead of FileVault, managed through his Meridian Staffing contractor kit agreement, and is reclaimed by IT automatically on his contract end date.",
    points: 8,
  },
  {
    id: 'ps-02',
    title: "Where's the employee handbook, and who's my manager?",
    answer: "The employee handbook lives in the Docs section of Brightfield, under Policies → People. Your manager is Jordan Ellis — you'll find their profile and contact details in Brightfield People. If you have onboarding questions that Jordan can't answer, the People Ops team is reachable via the #people-ops Slack channel.",
    altAnswer: "Head to Brightfield Docs → Policies → People to find the employee handbook. Jordan Ellis is your manager; their contact card is in Brightfield People. People Ops also has a Slack channel, #people-ops, for any questions that fall outside day-to-day line management.",
    detail: 'The handbook is in Brightfield Docs under Policies → People. Manager assignments are held in Brightfield People → Organisation.',
    start: 0, end: 1,
    system: 'HRIS',
    highlight: H.hrisCard,
    scene: scene('hris-record', { sidebarIndex: 1, rowIndex: -1, typedText: 'Priya Shah' }),
    note: NO_NOTE,
    scopedNote: "Marcus's day-to-day supervisor is Dana Whitfield, but contractual and employment matters must go through his Meridian Staffing account manager rather than through the Brightfield People Ops team.",
    points: 5,
  },
  {
    id: 'ps-03',
    title: 'Who do I ask about VPN or system access problems?',
    answer: "Raise a ticket in Brightfield's IT Support queue under the Access category. If the issue is urgent, ping #it-support on Slack and reference the ticket number. For VPN specifically, the IT team targets a four-hour response on working days.",
    altAnswer: "Open an Access ticket in the Brightfield IT Support queue for any VPN or access issue. Reference the ticket number in #it-support on Slack for faster triage. VPN tickets have a four-hour SLA on working days.",
    detail: 'Access issues are tracked in Brightfield IT Support → Access. SLA and escalation details are in the IT Operations runbook in Brightfield Docs.',
    start: 1, end: 2,
    system: 'ITSM',
    highlight: H.itsmDetail,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 1, typedText: 'Priya Shah' }),
    note: NO_NOTE,
    scopedNote: "Marcus's contractor kit goes through a separate restricted provisioning queue; the standard IT Support Access category still applies but his device configuration is handled by Meridian Staffing's IT contact.",
    points: 7,
  },
  {
    id: 'ps-04',
    title: 'How do I request time off?',
    answer: 'Go to Brightfield → Expenses → Time Off and submit a leave request; your manager Jordan Ellis gets an approval notification automatically. Annual leave accrues from your start date at 25 days per year, and the HR policy allows up to 5 days to be carried over to the following year. Requests should be submitted at least five working days in advance.',
    altAnswer: 'Submit leave requests through Brightfield Expenses → Time Off; Jordan Ellis is notified immediately. Your entitlement is 25 days per year accruing from 3 Aug 2026, with a 5-day carry-over allowance. Give at least five working days notice wherever possible.',
    detail: 'Leave requests are managed in Brightfield Expenses → Time Off. Accrual rates and carry-over rules are in the People policy in Brightfield Docs.',
    start: 2, end: 5,
    system: 'Expenses',
    highlight: H.docsCallout,
    scene: scene('docs-article', { sidebarIndex: 3, rowIndex: 0 }),
    note: tip('Requests made less than five working days in advance may be declined even when headcount allows, so plan ahead.'),
    scopedNote: 'Marcus is not entitled to paid annual leave as a contractor — his time-off terms are in his statement of work with Meridian Staffing rather than in Brightfield.',
    points: 6,
  },
  {
    id: 'ps-05',
    title: 'How do I submit an expense claim?',
    answer: 'Open Brightfield → Expenses → New Claim and fill in the description, amount, category and date. Claims under £150 self-approve; anything above £150 routes to Jordan Ellis for sign-off. Approved claims are paid in the next payroll run.',
    altAnswer: "Navigate to Brightfield → Expenses → New Claim to log a claim. The self-approval threshold is £150 — Jordan Ellis is notified automatically for anything above that. Reimbursement lands in the next payroll cycle.",
    detail: 'Expense claims are submitted and tracked in Brightfield Expenses. The approval-limit policy is documented in Brightfield Docs → Policies → Finance.',
    start: 3, end: 7,
    system: 'Expenses',
    highlight: H.expenseFields,
    scene: scene('expense-claim', { sidebarIndex: 5, rowIndex: -1, focusedField: 0, typedText: 'Priya Shah' }),
    note: NO_NOTE,
    scopedNote: 'Marcus submits expenses through the same Brightfield form, but reimbursement goes to his Meridian Staffing invoice rather than payroll — check with his account manager on the correct category codes.',
    points: 6,
  },
  {
    id: 'ps-06',
    title: 'What tools does my team use day to day?',
    answer: 'Platform Engineering uses GitHub for source control, Linear for issue tracking, and Datadog for observability. Internal communication runs on Slack; the main engineering channel is #platform-eng. Architecture decisions are recorded in Brightfield Docs under Engineering → ADRs.',
    altAnswer: 'The team works in GitHub, Linear and Datadog for code, tasks and monitoring. Slack is the primary comms channel — join #platform-eng first. Architecture decisions are in Brightfield Docs → Engineering → ADRs.',
    detail: 'Tool access is provisioned via Brightfield IT Support. The team channel and project board are linked from the Platform Engineering page in Brightfield People.',
    start: 1, end: 3,
    system: 'Project',
    highlight: H.projectCard(0),
    scene: scene('project-board', { sidebarIndex: 4, rowIndex: 0 }),
    note: NO_NOTE,
    scopedNote: 'Marcus works in a separate QA project board and does not have write access to the Platform Engineering Linear workspace by default — his access is scoped to the testing lanes only.',
    points: 7,
  },
  {
    id: 'ps-07',
    title: 'How do I get access to the deployment or test environment?',
    answer: 'Raise ticket IT-4390 in Brightfield IT Support → Access, specifying which environment you need and your GitHub username. The Platform team lead approves staging access; production access requires a second sign-off from the security team. Allow two working days.',
    altAnswer: 'Open an Access ticket in Brightfield IT Support and include the target environment and your GitHub username. Staging needs the Platform team lead; production access also needs the security team. Budget two working days for the approval chain.',
    detail: 'Environment access requests are tracked in Brightfield IT Support. Access provisioning rules are in Brightfield Docs → Engineering → Access Runbook.',
    start: 5, end: 10,
    system: 'ITSM',
    highlight: H.itsmRow2,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 2, typedText: 'Priya Shah' }),
    note: warn('Do not share staging credentials — each engineer must have their own provisioned account, per the security policy in Brightfield Docs.'),
    scopedNote: "Marcus's Restricted tier means his access requests go through a separate restricted queue and require both the security team and the IT compliance lead before they are approved.",
    points: 9,
  },
  {
    id: 'ps-08',
    title: "What's the code review / QA sign-off process?",
    answer: 'All pull requests require at least one approving review from a Platform Engineering peer before they can be merged. Changes touching the authentication or payments paths require a second review from a security-cleared engineer. QA runs automated checks in CI and Marcus Webb handles manual sign-off on regression lanes.',
    altAnswer: "Platform Engineering's rule is one peer approval per pull request, with a second security-cleared review for auth or payments changes. CI runs the automated suite; manual regression sign-off goes to the QA team, which currently includes Marcus Webb.",
    detail: 'The code review process is documented in Brightfield Docs → Engineering → Development Process. Pull requests are tracked in GitHub; CI results surface in Linear.',
    start: 7, end: 14,
    system: 'Docs',
    highlight: H.docsIntro,
    scene: scene('docs-article', { sidebarIndex: 3, rowIndex: -1 }),
    note: tip('Security-path PRs blocked waiting for a cleared reviewer are not an emergency — ping #security-reviews in Slack rather than asking someone to approve without reading.'),
    scopedNote: "Marcus is on the receiving end of this process as the QA contact; he does not have write access to the main application repository and cannot approve PRs himself.",
    points: 8,
  },
  {
    id: 'ps-09',
    title: 'Am I enrolled in benefits or a pension?',
    answer: "You're automatically enrolled in the company pension at 5% employee contribution and 4% employer contribution from your start date. Healthcare and dental are opt-in; enrol within 30 days of joining through Brightfield People → Benefits. If you miss the 30-day window, the next enrolment date is 1 January.",
    altAnswer: "Pension auto-enrolment happens from your start date at 5% employee and 4% employer contributions. Healthcare and dental are opt-in — log into Brightfield People → Benefits and complete enrolment within your first 30 days. The next open window after that is 1 January.",
    detail: "Benefits enrolment is managed in Brightfield People → Benefits. Pension details are held in the company's Nest scheme; documentation is in Brightfield Docs → Policies → Reward.",
    start: 2, end: 5,
    system: 'HRIS',
    highlight: H.hrisRow(4),
    scene: scene('hris-record', { sidebarIndex: 1, rowIndex: 1, typedText: 'Priya Shah' }),
    note: tip('Log into Brightfield People on day one to confirm your pension is showing — auto-enrolment occasionally needs a nudge if your record was created after the overnight payroll sync.'),
    scopedNote: 'Marcus is a contractor through Meridian Staffing and is not entitled to company benefits or pension via Brightfield — any benefit queries should go to his Meridian account manager.',
    points: 7,
  },
  {
    id: 'ps-10',
    title: "Who do I contact if I'm stuck and my manager's not around?",
    answer: "If Jordan Ellis is unavailable, the first stop is the #platform-eng Slack channel — the team is active during UK working hours. For HR or policy matters, People Ops is in #people-ops. For urgent IT issues, the IT Support queue and #it-support Slack channel are both monitored 24 / 7.",
    altAnswer: "When Jordan is away, post in #platform-eng for technical queries or #people-ops for HR matters. IT Support and the #it-support Slack channel run around the clock for urgent access or hardware problems.",
    detail: "Escalation contacts are listed in the Platform Engineering team page in Brightfield People. The on-call rota is in Brightfield Docs → Engineering → On-Call Runbook.",
    start: 0, end: 90,
    system: 'Comms',
    highlight: H.commsReply,
    scene: scene('comms-thread', { sidebarIndex: 6, rowIndex: -1, typedText: 'Priya Shah' }),
    note: NO_NOTE,
    scopedNote: "Marcus's day-to-day supervisor Dana Whitfield handles most escalations, but contractual or financial matters go through his Meridian Staffing account manager.",
    points: 5,
  },
]


// ─── Quiz helpers ─────────────────────────────────────────────────────────────

function opt(id: string, text: string): QuizOption { return { id, text } }

function result(
  chosenOptionId: string, correct: boolean, score: number,
  attemptedAt: string, acknowledgement: string,
): QuizResult {
  return { chosenOptionId, correct, score, attemptedAt, passThreshold: 80, acknowledgement }
}

// ─── Priya's quiz ─────────────────────────────────────────────────────────────

const priyaQuiz: Question[] = [

  // ── Day 3: Spotting and reporting security issues ─────────────────────────

  ...stampDay(3, 'Spotting and reporting security issues', [
    {
      id: 'ps-q01',
      prompt: 'You receive an email asking you to reset your Brightfield password by clicking a link. The sender looks legitimate. What should you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Report it to IT Support via #it-support and do not click the link'), opt('b','Click the link to check whether it is genuine'), opt('c','Forward it to a teammate to see what they think'), opt('d','Ignore it and delete the email')],
      correctOptionId: 'a',
      explanation: "Brightfield IT will never ask you to reset your password by email. Reporting it first — before clicking anything — is correct because a link in a phishing email can execute even if you don't enter credentials. Deleting it without reporting means the phishing campaign continues for your colleagues.",
      altExplanation: "The correct action is to report rather than click: once the IT team knows about the campaign they can block the sending domain for everyone. Forwarding to a teammate exposes them to the same risk and does nothing to address the threat.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '6 Aug 2026, 09:41', 'Confirmed understanding of the phishing-reporting process.'),
    },
    {
      id: 'ps-q02',
      prompt: 'A colleague says they have forgotten their access badge and asks to borrow yours for five minutes to collect a parcel from the secure delivery room.',
      system: 'SSO' as SourceSystem,
      options: [opt('a','Decline and suggest they contact Facilities to arrange temporary access'), opt('b','Lend them the badge for five minutes'), opt('c','Accompany them to the delivery room using your badge'), opt('d','Report the request to security immediately')],
      correctOptionId: 'a',
      explanation: "Access badges are tied to individual identities in the SSO system — sharing them breaks the audit trail and potentially breaches the physical security policy. The correct response is to decline and point them to Facilities, who can issue temporary access without creating an audit gap. Accompanying them yourself is safer than lending the badge, but still allows unauthorised access to the secure area.",
      altExplanation: "Lending a badge lets someone else act under your identity in a controlled area. Directing them to Facilities keeps the audit trail intact and is the response the security policy requires. Reporting immediately is only necessary if the request seems malicious rather than forgetful.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '6 Aug 2026, 09:48', 'Confirmed understanding of physical access policy.'),
    },
    {
      id: 'ps-q03',
      prompt: "You find a USB drive in the office kitchen with a label reading 'Salaries Q3'. What is the safest course of action?",
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Hand it to IT Support without plugging it in'), opt('b','Plug it in to see whether it contains anything sensitive'), opt('c','Leave it where you found it in case the owner returns'), opt('d','Put it in lost property and log a note on Slack')],
      correctOptionId: 'a',
      explanation: "Unknown USB drives are a well-documented attack vector — plugging one in can execute malware before any antivirus scan runs. Handing it directly to IT Support, still sealed, is correct because they can investigate safely. Leaving it or logging it informally does nothing to prevent someone else from plugging it in.",
      altExplanation: "The risk with an unknown USB drive is not its contents but what it might do when connected. IT Support has the tools to examine it safely; giving it to them untouched is the only response that protects the wider network.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '6 Aug 2026, 09:55', 'Confirmed understanding of removable-media policy.'),
    },
    {
      id: 'ps-q04',
      kind: 'written' as const,
      prompt: "In your own words, describe what you should do if you accidentally send a document containing personal data to the wrong email address.",
      system: 'Docs' as SourceSystem,
      options: [],
      correctOptionId: '',
      explanation: "An accidental data breach must be reported to the Data Protection team within 24 hours so they can assess whether it requires regulatory notification under UK GDPR. You should also recall the email if your mail client allows it and document what was sent, to whom, and when.",
      altExplanation: "Immediate disclosure to the Data Protection team is mandatory — the clock starts from the moment you become aware of the incident, not from when you decide it is serious enough to report.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: -1, typedText: 'Priya Shah' }),
      points: 10,
      writtenAnswer: "I would try to recall the email and then let the Data Protection team know what happened, including what data was in the document.",
      modelAnswer: "Attempt to recall the email immediately, report the incident to the Data Protection team within 24 hours with a description of the data involved, the recipient and the time sent, and document everything in case regulatory notification is required under UK GDPR.",
      missedPoint: "Did not mention the 24-hour reporting deadline or the possibility of regulatory notification.",
      result: result('', false, 65, '6 Aug 2026, 10:03', 'Partially completed — review the data-breach response procedure in Brightfield Docs.'),
    },
  ]),

  // ── Day 5: Leave, hours and benefits ──────────────────────────────────────

  ...stampDay(5, 'Leave, hours and benefits', [
    {
      id: 'ps-q05',
      prompt: 'You want to book two weeks off in August. What is the minimum notice you should give, and where do you submit the request?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Five working days, via Brightfield Expenses → Time Off'), opt('b','Two weeks, via email to your manager'), opt('c','One month, via the Brightfield People portal'), opt('d','No minimum — annual leave can be booked any time')],
      correctOptionId: 'a',
      explanation: "The leave policy requires five working days notice minimum, and requests are submitted through Brightfield Expenses → Time Off. Emailing your manager directly bypasses the approval workflow and does not formally book the leave. The policy specifies five working days — not one month — though longer notice is always appreciated.",
      altExplanation: "Brightfield Expenses → Time Off is the only channel that triggers the manager approval workflow and records the leave against your entitlement. Five working days is the policy minimum for any leave request.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 10:12', 'Confirmed understanding of the leave-booking process.'),
    },
    {
      id: 'ps-q06',
      prompt: 'Your first day is 3 Aug 2026. How many days of annual leave can you carry over to the following leave year?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Up to 5 days'), opt('b','Up to 10 days'), opt('c','None — all leave must be taken in the year it accrues'), opt('d','Unlimited, subject to manager approval')],
      correctOptionId: 'a',
      explanation: "Brightfield's leave policy allows up to 5 days to be carried over to the following leave year. Unused leave beyond that is forfeited. Carry-over is automatic but must be used by 31 March of the following year — it does not accumulate indefinitely.",
      altExplanation: "The carry-over allowance is 5 days — anything above that is forfeited at the end of the leave year. The 31 March deadline for carried-over days is a separate rule to watch.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 10:19', 'Confirmed understanding of leave carry-over policy.'),
    },
    {
      id: 'ps-q07',
      prompt: 'You want to enrol in the company healthcare scheme. When is the deadline for new starters?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Within 30 days of joining'), opt('b','By the end of your first month'), opt('c','During the January open enrolment window only'), opt('d','Any time in your first year')],
      correctOptionId: 'a',
      explanation: "New starters have 30 days from their start date to opt into the healthcare and dental schemes through Brightfield People → Benefits. Missing this window means waiting until the next open enrolment period on 1 January. Thirty days and 'end of first month' are close but not the same — if you start on the 3rd, you have until the 2nd of the following month.",
      altExplanation: "The 30-day window is a firm deadline tied to your start date, not the calendar month. Brightfield People → Benefits is where you enrol; after 30 days you wait until 1 January.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 10:26', 'Confirmed understanding of benefits enrolment deadline.'),
    },
    {
      id: 'ps-q08',
      prompt: 'What are the default employee and employer pension contribution rates from your start date?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','5% employee, 4% employer'), opt('b','3% employee, 3% employer'), opt('c','4% employee, 5% employer'), opt('d','You choose your own rate during onboarding')],
      correctOptionId: 'a',
      explanation: "Auto-enrolment sets contributions at 5% employee and 4% employer from your start date — the employee rate is slightly higher. These are the statutory defaults; you can increase your own contribution at any time through Brightfield People → Benefits.",
      altExplanation: "The default split is 5% from the employee and 4% from the employer. It is worth logging in on day one to confirm the record is showing correctly, as overnight payroll syncs occasionally miss new-starter records.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 10:33', 'Confirmed understanding of pension contribution defaults.'),
    },
  ]),

  // ── Day 9: Expenses and data handling ─────────────────────────────────────

  ...stampDay(9, 'Expenses and data handling', [
    {
      id: 'ps-q09',
      prompt: 'You buy a £95 piece of kit for your home office. Which of the following is correct?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Submit via Brightfield Expenses → New Claim — it self-approves below £150'), opt('b','Submit via Brightfield Expenses — it routes to Jordan Ellis for sign-off'), opt('c','Email Jordan Ellis directly with the receipt — Brightfield is for larger claims'), opt('d','Claims under £100 are not reimbursable — absorb the cost yourself')],
      correctOptionId: 'a',
      explanation: "Claims under £150 self-approve in Brightfield Expenses — no manager sign-off is needed. The threshold is £150, so £95 clears it without routing to Jordan Ellis. Emailing a receipt directly to a manager is not the process and creates no audit trail.",
      altExplanation: "The self-approval threshold is £150. A £95 claim goes through Brightfield Expenses → New Claim and completes without manager involvement. Claims of any amount require the Brightfield form, not an email to a manager.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 14:05', 'Confirmed understanding of the expense self-approval threshold.'),
    },
    {
      id: 'ps-q10',
      prompt: "You're not sure whether a document is safe to share externally. What should you do before sending it?",
      system: 'Docs' as SourceSystem,
      options: [opt('a','Check the document classification in Brightfield Docs and confirm with your manager if in doubt'), opt('b','Send it and let the recipient decide whether to forward it further'), opt('c','Remove any names from the document and then share it'), opt('d','Ask a colleague who has shared similar documents before')],
      correctOptionId: 'a',
      explanation: "Brightfield Docs uses document classification to indicate what can be shared externally. Checking the classification is the correct first step; if it is unclear, confirming with your manager before sending is the right precaution. Removing names does not remove other personal data or confidential information.",
      altExplanation: "The document classification label in Brightfield Docs is the definitive guide. When in doubt, checking with your manager before sending is correct — sharing and hoping for the best is not a compliant approach under UK GDPR.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 14:12', 'Confirmed understanding of document classification policy.'),
    },
    {
      id: 'ps-q11',
      prompt: 'When is Jordan Ellis notified about an expense claim you have submitted?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Only when the claim exceeds £150'), opt('b','For every claim, regardless of amount'), opt('c','Never — claims are approved by finance only'), opt('d','Only when the claim is submitted using the Contractor category')],
      correctOptionId: 'a',
      explanation: "The notification threshold is £150. Claims below that self-approve with no manager involvement. Jordan Ellis only receives an approval notification for claims at or above £150. The Contractor category is a separate route for Marcus and other agency staff.",
      altExplanation: "Jordan Ellis is only in the approval loop for claims of £150 or more. For smaller amounts Brightfield Expenses handles approval automatically, keeping the process light for routine purchases.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 14:18', 'Confirmed understanding of expense approval routing.'),
    },
    {
      id: 'ps-q12',
      prompt: 'Under UK GDPR, how soon after discovering an accidental data breach must you report it to the Data Protection team?',
      system: 'Docs' as SourceSystem,
      options: [opt('a','Within 24 hours of becoming aware'), opt('b','Within 72 hours of becoming aware'), opt('c','Within one week'), opt('d','Only if the breach involved more than ten people')],
      correctOptionId: 'a',
      explanation: "Brightfield's internal policy requires reporting to the Data Protection team within 24 hours — tighter than the statutory 72-hour window to the ICO, so the team has time to assess and decide whether to escalate. The 72-hour figure applies to formal regulatory notification, not to the internal report.",
      altExplanation: "Brightfield's rule is 24 hours for the internal report. The 72-hour statutory window to the ICO is a separate obligation that the Data Protection team handles once they are aware — which is why the internal 24-hour deadline exists.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 14:25', 'Confirmed understanding of data-breach reporting timeline.'),
    },
  ]),

  // ── Day 20: Requesting extra equipment ────────────────────────────────────

  ...stampDay(20, 'Requesting extra equipment', [
    {
      id: 'ps-q13',
      prompt: 'You need a second monitor for your home office setup. What is the correct process?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise a hardware request in Brightfield IT Support and await manager approval'), opt('b','Buy it and submit an expense claim — hardware is always reimbursable'), opt('c','Ask a colleague to raise the ticket on your behalf to speed things up'), opt('d','Order it directly from the approved supplier and notify IT afterwards')],
      correctOptionId: 'a',
      explanation: "Hardware requests go through Brightfield IT Support, where the manager is notified as part of the workflow. Buying it and claiming it back bypasses the approval process and is not guaranteed to be reimbursed — the policy is clear that pre-approved purchases are required. Having a colleague raise the ticket does not satisfy the requirement that the request is linked to your profile.",
      altExplanation: "The correct channel is Brightfield IT Support. Hardware purchases made without pre-approval are not automatically reimbursable — raising the ticket first is the only route that guarantees the request is assessed and tracked correctly.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 11:02', 'Confirmed understanding of the hardware request process.'),
    },
    {
      id: 'ps-q14',
      prompt: 'A hardware request in IT Support has been waiting for three working days with no update. What should you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Post the ticket number in #it-support on Slack to ask for an update'), opt('b','Raise a duplicate ticket to escalate'), opt('c','Contact the IT director directly'), opt('d','Buy the equipment yourself and claim it back')],
      correctOptionId: 'a',
      explanation: "Posting the ticket number in #it-support is the correct escalation path — it is monitored by the IT team and creates a public record of the delay. Raising a duplicate ticket makes the queue harder to manage and slows down the original request. Contacting the IT director directly is excessive for a routine hardware request.",
      altExplanation: "The #it-support Slack channel is designed for exactly this kind of follow-up. The ticket number gives the team immediate context. Duplicate tickets are counterproductive — they do not move the original any faster.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 11:09', 'Confirmed understanding of the IT Support escalation process.'),
    },
    {
      id: 'ps-q15',
      prompt: 'You need access to a production environment to investigate a live incident. Your staging access was approved two weeks ago. What do you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise a new IT Support Access ticket for production — staging approval does not carry over'), opt('b','Use your staging credentials — they typically work in production too'), opt('c','Ask a colleague to log in with their production credentials on your behalf'), opt('d','Escalate directly to the CTO given the incident severity')],
      correctOptionId: 'a',
      explanation: "Staging and production are separate environments with separate access controls. Staging approval does not grant production access — a new ticket is required and needs a second security-team sign-off. Using a colleague's credentials is a security-policy violation regardless of the urgency.",
      altExplanation: "Production access is a separate approval, explicitly requiring the security team as a second reviewer. The urgency of an incident does not waive the approval requirement — raise the ticket and flag it as urgent in #it-support.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 11:16', 'Confirmed understanding of production access requirements.'),
    },
    {
      id: 'ps-q16',
      prompt: 'Your MacBook develops a fault and needs to be sent for repair. What is the first step?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise an IT Support ticket describing the fault — IT will arrange collection'), opt('b','Send it to the Apple repair centre directly and claim the cost back'), opt('c','Ask your manager to request a replacement on your behalf'), opt('d','Back it up and buy a personal laptop to use in the interim')],
      correctOptionId: 'a',
      explanation: "Brightfield-issued devices go through IT Support for repairs — the team arranges collection and a loan device if available. Sending it directly to Apple breaks the Jamf MDM chain and may result in data being unmanaged. Claiming back a personal repair is not guaranteed under the equipment policy.",
      altExplanation: "IT Support manages the full repair lifecycle for company devices, including collection and loan equipment. Going outside that process creates data-handling risks because the device leaves the Jamf management envelope.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 11:22', 'Confirmed understanding of device repair process.'),
    },
  ]),

  // ── Day 30: Contract review and leave carry-over ──────────────────────────

  ...stampDay(30, 'Contract review and leave carry-over', [
    {
      id: 'ps-q17',
      prompt: "It is 1 September. You have 12 days of annual leave remaining and 3 days carried over from last year. How many days must you use before 31 March?",
      system: 'HRIS' as SourceSystem,
      options: [opt('a','The 3 carried-over days must be used by 31 March; the 12 current-year days follow their own deadline'), opt('b','All 15 days must be used by 31 March'), opt('c','Carried-over days have no deadline — they accumulate indefinitely'), opt('d','Carried-over days expire at the end of the current leave year, not 31 March')],
      correctOptionId: 'a',
      explanation: "The 3 carried-over days have a 31 March deadline — they do not roll over a second time. The 12 current-year days follow the standard leave-year deadline, which depends on when the leave year ends. The two balances have different deadlines, which is why they are tracked separately in Brightfield People.",
      altExplanation: "Carry-over days expire on 31 March of the year following their accrual — that is the explicit rule in the leave policy. Current-year leave has its own deadline tied to the leave year. Mixing the two up can result in unexpected forfeiture.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 09:30', 'Confirmed understanding of carry-over leave deadlines.'),
    },
    {
      id: 'ps-q18',
      prompt: 'Your probation review is due at the end of month three. Who is responsible for scheduling it?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Your manager Jordan Ellis initiates it through Brightfield People'), opt('b','You initiate it by booking time with Jordan Ellis directly'), opt('c','People Ops schedules it automatically on day 90'), opt('d','It only happens if you request it via a Brightfield People form')],
      correctOptionId: 'a',
      explanation: "Probation reviews are initiated by the line manager through Brightfield People, which triggers a structured review workflow. You should not need to chase it, but it is worth checking in with Jordan Ellis around week ten to confirm a date is in the diary. People Ops does not auto-schedule it — that is the manager's responsibility.",
      altExplanation: "The probation review is a manager-led process recorded in Brightfield People. Jordan Ellis will initiate it; the structured workflow ensures it is formally captured. Proactively confirming a date with your manager around week ten is good practice.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 09:37', 'Confirmed understanding of the probation review process.'),
    },
    {
      id: 'ps-q19',
      prompt: 'You want to request a permanent change to your working hours from month four. What is the correct route?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Submit a flexible-working request through Brightfield People → HR Requests'), opt('b','Agree a change with Jordan Ellis informally and update your calendar'), opt('c','Email People Ops directly with the proposed new schedule'), opt('d','Flexible working can only be requested after 26 weeks of employment')],
      correctOptionId: 'a',
      explanation: "Flexible working requests are submitted formally through Brightfield People → HR Requests, which creates a record and triggers the proper approval workflow. An informal agreement with your manager has no HR standing and will not update your contracted hours. Brightfield's policy allows flexible working requests from day one, not after 26 weeks.",
      altExplanation: "Brightfield People → HR Requests is the correct channel for any change to contracted hours — it creates a formal record and ensures the payroll and HR systems are updated. An informal agreement with your manager is not binding from an HR or payroll perspective.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 09:44', 'Confirmed understanding of the flexible-working request process.'),
    },
    {
      id: 'ps-q20',
      prompt: 'At your month-three review, Jordan Ellis asks whether you want to extend your probation by one month. What does this mean for your leave entitlement?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Your leave continues to accrue normally — probation extension does not pause entitlement'), opt('b','Leave accrual is paused during any probation extension'), opt('c','You must use all accrued leave before the extension period begins'), opt('d','Probation extension resets your leave year to the extension start date')],
      correctOptionId: 'a',
      explanation: "Leave continues to accrue during a probation extension — probation status affects performance review and confirmation of employment, not leave entitlement. Accrual runs from the start date regardless of probation outcome. This is documented in the People policy in Brightfield Docs.",
      altExplanation: "Probation and leave entitlement are independent. Accrual begins from day one and does not pause for probation reviews or extensions. The leave balance in Brightfield People will reflect the correct number regardless of probation status.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Priya Shah' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 09:51', 'Confirmed understanding of leave entitlement during probation extension.'),
    },
  ]),
]

// Fix typo in ps-q11
;(priyaQuiz.find(q => q.id === 'ps-q11') as Question).system = 'Expenses'



// ─── Spec-row helper ──────────────────────────────────────────────────────────

function specRows(p: Profile['persona']): SpecItem[] {
  return [
    { label: 'Name',           value: p.name },
    { label: 'Role',           value: p.role === 'supervisor' ? 'Supervisor' : 'New starter' },
    { label: 'Team',           value: p.team },
    { label: 'Employment',     value: p.employmentType },
    { label: 'Start date',     value: p.startDate },
    { label: 'Manager',        value: p.manager },
    { label: 'Security tier',  value: p.securityTier },
  ]
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const SHARED_SYSTEMS: Profile['connectedSystems'] = ['SSO', 'HRIS', 'ITSM', 'Docs', 'Project', 'Expenses', 'Comms']

const USAGE_NOTES: string[] = [
  "Everything Compass says is generated from Brightfield's live systems and scoped to your own role, team and security tier — confirm anything safety- or compliance-critical against the source system if in doubt.",
  "Tutor results are recorded against your profile as evidence of completed onboarding training, in line with Brightfield's compliance requirements.",
  "Access levels and policy answers shown here reflect your record at the time this report was generated — they are not retroactive if your role changes.",
]

// ─── Priya's profile ──────────────────────────────────────────────────────────

const priyaPersona: Profile['persona'] = {
  id: 'priya-shah',
  name: 'Priya Shah',
  role: 'new-starter',
  employmentType: 'Full-time',
  team: 'Platform Engineering',
  os: 'macOS',
  location: 'London',
  startDate: '3 Aug 2026',
  manager: 'Jordan Ellis',
  securityTier: 'Standard',
  initials: 'PS',
}

const priyaMeta: SystemsMeta = {
  workspaceName:    'Brightfield',
  connectedSystems: 7,
  recordCount:      3400,
  connectionType:   'SSO + MCP',
  lastSynced:       'moments ago',
}

export const PRIYA_PROFILE: Profile = {
  persona:          priyaPersona,
  title:            'Priya Shah',
  subtitle:         'Senior Backend Engineer, Platform Engineering — started 3 Aug 2026',
  programmeDays:    90,
  connectedSystems: SHARED_SYSTEMS,
  usageNotes:       USAGE_NOTES,
  specRows:         specRows(priyaPersona),
  topics:           priyaTopics,
  quiz:             priyaQuiz,
  onboardingPct:    62,
  systemsMeta:      priyaMeta,
}


// ─── Runtime helpers ──────────────────────────────────────────────────────────

/** Deep-copies a profile so edits never mutate the seed data. */
export function deepCopyProfile(p: Profile): Profile {
  return {
    persona: { ...p.persona },
    title: p.title,
    subtitle: p.subtitle,
    programmeDays: p.programmeDays,
    connectedSystems: [...p.connectedSystems],
    usageNotes: [...p.usageNotes],
    specRows: p.specRows.map(s => ({ ...s })),
    topics: p.topics.map(t => ({
      ...t,
      highlight: t.highlight ? { ...t.highlight } : undefined,
      scene: t.scene ? { ...t.scene } : undefined,
      note: t.note ? { ...t.note } : undefined,
    })),
    quiz: p.quiz.map(q => ({
      ...q,
      highlight: q.highlight ? { ...q.highlight } : undefined,
      scene: q.scene ? { ...q.scene } : undefined,
      note: q.note ? { ...q.note } : undefined,
      options: q.options.map(o => ({ ...o })),
      result: q.result ? { ...q.result } : undefined,
    })),
    onboardingPct: p.onboardingPct,
    systemsMeta: { ...p.systemsMeta },
  }
}

/** Returns initials for a display name. */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return ((words[0]![0] ?? '') + (words[words.length - 1]![0] ?? '')).toUpperCase()
}

/** Recursively replaces substrings throughout an object. */
function deepReplace(value: unknown, replacements: [string, string][]): unknown {
  if (typeof value === 'string') {
    let s = value
    for (const [from, to] of replacements) {
      s = s.split(from).join(to)
    }
    return s
  }
  if (Array.isArray(value)) {
    return value.map(item => deepReplace(item, replacements))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepReplace(v, replacements)
    }
    return out
  }
  return value
}

/**
 * Swaps the seed persona's name and employer throughout the whole profile.
 * Returns an unchanged deep copy when both inputs are empty.
 * Replacements are ordered: full name first, then first name, then employer —
 * so "Priya Shah" is replaced before "Priya" ever runs alone.
 */
export function personalise(profile: Profile, newName: string, newCompany: string): Profile {
  const copy = deepCopyProfile(profile)
  if (!newName && !newCompany) return copy

  const oldFullName  = profile.persona.name
  const oldFirstName = oldFullName.split(' ')[0] ?? oldFullName
  const oldCompany   = 'Brightfield'

  const replacements: [string, string][] = []
  if (newName)    replacements.push([oldFullName, newName], [oldFirstName, newName.split(' ')[0] ?? newName])
  if (newCompany) replacements.push([oldCompany, newCompany])

  const replaced = deepReplace(copy, replacements) as Profile
  replaced.persona.initials = nameInitials(newName || oldFullName)
  return replaced
}
