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


// ─── Marcus's topics ──────────────────────────────────────────────────────────

const marcusTopics: Topic[] = [
  {
    id: 'mw-01',
    title: 'How do I get my laptop set up?',
    answer: "Your Windows laptop ships from Meridian Staffing's IT partner to your home address before day one. Open ticket IT-4471 in the Brightfield IT Support queue to confirm delivery; your BitLocker recovery key is held by Meridian's IT contact rather than the Brightfield IT team. The contractor onboarding checklist in Brightfield People covers VPN client setup and corporate certificate installation.",
    altAnswer: "Meridian Staffing's IT partner sends your Windows laptop directly so it arrives before day one. Raise ticket IT-4471 in the IT Support queue to confirm receipt — your BitLocker key is held by Meridian, not Brightfield IT. The contractor checklist in Brightfield People walks through VPN and corporate certificate setup.",
    detail: 'Contractor device provisioning is co-managed by Meridian Staffing and the Brightfield IT Support queue. The BitLocker recovery key is held by Meridian; setup instructions are in Brightfield People → Onboarding → Contractors.',
    start: 0, end: 1,
    system: 'ITSM',
    highlight: H.itsmRow0,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 0, typedText: 'Marcus Webb' }),
    note: warn('This laptop is contractor equipment — Brightfield IT will reclaim it automatically on your contract end date. Back up any work files to OneDrive before that date.'),
    scopedNote: "Priya receives a company-owned MacBook Pro enrolled in Jamf MDM; her FileVault key is held by the Brightfield IT team.",
    points: 8,
  },
  {
    id: 'mw-02',
    title: "Where's the employee handbook, and who's my supervisor?",
    answer: "The contractor guide rather than the employee handbook is your reference — it lives in Brightfield Docs under Policies → Contractors. Your day-to-day supervisor is Dana Whitfield, whose profile and contact details are in Brightfield People. Employment and contractual matters must go through your Meridian Staffing account manager rather than Brightfield People Ops.",
    altAnswer: "Head to Brightfield Docs → Policies → Contractors for your reference guide rather than the employee handbook. Dana Whitfield is your on-site supervisor; their contact is in Brightfield People. For anything contractual, your Meridian Staffing account manager is the right first port of call.",
    detail: 'The contractor policy guide is in Brightfield Docs → Policies → Contractors. Supervisor assignments are in Brightfield People → Organisation.',
    start: 0, end: 1,
    system: 'HRIS',
    highlight: H.hrisCard,
    scene: scene('hris-record', { sidebarIndex: 1, rowIndex: -1, typedText: 'Marcus Webb', focusedField: 1 }),
    note: NO_NOTE,
    scopedNote: "Priya's equivalent is the employee handbook and her manager Jordan Ellis — both handled entirely within Brightfield People Ops.",
    points: 5,
  },
  {
    id: 'mw-03',
    title: 'Who do I ask about VPN or system access problems?',
    answer: "Raise an Access ticket in Brightfield IT Support — but note that contractor access requests go into a restricted provisioning queue rather than the standard one. If the issue is urgent, ping #it-support on Slack and include your ticket number. Meridian's IT contact is also available for issues specific to your contractor device.",
    altAnswer: "Open an Access ticket in the Brightfield IT Support restricted queue for VPN or access problems. Reference the ticket in #it-support on Slack to flag urgency. Device-specific issues can also go to Meridian's IT contact.",
    detail: 'Contractor access requests are tracked in Brightfield IT Support → Access (Restricted). Meridian IT contact details are in your Meridian welcome pack.',
    start: 1, end: 2,
    system: 'ITSM',
    highlight: H.itsmDetail,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 1, typedText: 'Marcus Webb' }),
    note: NO_NOTE,
    scopedNote: "Priya's requests go through the standard Access queue with a four-hour SLA; Marcus's Restricted tier means his queue has different routing and approval requirements.",
    points: 7,
  },
  {
    id: 'mw-04',
    title: 'How do I request time off?',
    answer: "As a contractor, your time-off terms are in your statement of work with Meridian Staffing rather than in Brightfield's leave policy. Notify Dana Whitfield in advance using the agreed notice in your SOW, and log the absence with your Meridian account manager for payroll purposes. Brightfield does not process contractor leave through the Expenses → Time Off route.",
    altAnswer: "Contractor time off is governed by your Meridian Staffing SOW, not the Brightfield leave policy. Give Dana Whitfield advance notice per the SOW terms and inform your Meridian account manager so payroll is correct. Do not raise leave requests in Brightfield Expenses.",
    detail: 'Contractor time-off terms are held in the Meridian Staffing SOW, not in Brightfield. Absences should be reported to both Dana Whitfield and the Meridian account manager.',
    start: 2, end: 5,
    system: 'Expenses',
    highlight: H.docsCallout,
    scene: scene('docs-article', { sidebarIndex: 3, rowIndex: 1 }),
    note: warn("Using the Brightfield leave system for contractor absences will trigger a payroll mismatch — always use the Meridian channel instead."),
    scopedNote: "Priya accrues 25 days of paid annual leave per year through Brightfield, with up to 5 days carry-over allowed.",
    points: 6,
  },
  {
    id: 'mw-05',
    title: 'How do I submit an expense claim?',
    answer: "Submit contractor expenses through Brightfield Expenses → New Claim, selecting the Contractor category. Reimbursement flows to your Meridian Staffing invoice rather than payroll — confirm the correct cost-code with your Meridian account manager before submitting. Claims over £150 still route to Dana Whitfield for sign-off.",
    altAnswer: "Use Brightfield Expenses → New Claim and pick the Contractor category for all expense submissions. The money goes to your Meridian invoice, not your pay — check the cost-code with Meridian first. Anything over £150 needs Dana Whitfield's approval.",
    detail: 'Contractor expense claims are in Brightfield Expenses → New Claim (Contractor category). Reimbursement routes via Meridian Staffing invoicing; cost-code guidance is in the Meridian contractor portal.',
    start: 3, end: 7,
    system: 'Expenses',
    highlight: H.expenseFields,
    scene: scene('expense-claim', { sidebarIndex: 5, rowIndex: -1, focusedField: 0, typedText: 'Marcus Webb' }),
    note: NO_NOTE,
    scopedNote: "Priya's claims reimburse directly to her payroll; she uses the standard Employee category rather than Contractor.",
    points: 6,
  },
  {
    id: 'mw-06',
    title: 'What tools does my team use day to day?',
    answer: 'Quality Assurance uses TestRail for test case management, Jira for bug tracking, and Selenium Grid for automated UI tests. Internal communication is on Slack; join #qa-team and #platform-eng for the channels most relevant to your work. Test results and sign-off status are tracked in the QA board in Brightfield Projects.',
    altAnswer: 'The QA team works in TestRail, Jira and Selenium Grid for test management, bugs and automation. Slack channels #qa-team and #platform-eng are both relevant. The QA sign-off board is in Brightfield Projects.',
    detail: 'QA tool access is provisioned via Brightfield IT Support. The QA board is in Brightfield Projects; TestRail and Jira credentials are provisioned by IT.',
    start: 1, end: 3,
    system: 'Project',
    highlight: H.projectCard(1),
    scene: scene('project-board', { sidebarIndex: 4, rowIndex: 1 }),
    note: NO_NOTE,
    scopedNote: "Priya uses GitHub, Linear and Datadog — the Engineering stack — rather than the QA toolchain.",
    points: 7,
  },
  {
    id: 'mw-07',
    title: 'How do I get access to the deployment or test environment?',
    answer: "Raise an Access ticket in Brightfield IT Support specifying the test environment and your Windows username. Because you're on the Restricted security tier, your request goes through the restricted provisioning queue and requires approval from both the security team and the IT compliance lead. Budget three to four working days.",
    altAnswer: "Open an Access ticket in the restricted provisioning queue in Brightfield IT Support, naming the test environment and your Windows username. Restricted-tier approvals need the security team and IT compliance lead — allow three to four working days.",
    detail: 'Restricted-tier environment access is tracked in Brightfield IT Support → Access (Restricted). Approval requirements are in Brightfield Docs → Security → Contractor Access Policy.',
    start: 5, end: 10,
    system: 'ITSM',
    highlight: H.itsmRow2,
    scene: scene('itsm-ticket', { sidebarIndex: 2, rowIndex: 2, typedText: 'Marcus Webb' }),
    note: warn('Restricted-tier contractors must not access production environments — the security policy in Brightfield Docs is explicit on this and violations are escalated to the compliance team.'),
    scopedNote: "Priya's Standard-tier requests go through the normal Access queue and only need the Platform team lead for staging access.",
    points: 9,
  },
  {
    id: 'mw-08',
    title: "What's the code review / QA sign-off process?",
    answer: "QA sign-off is your primary responsibility: you review test results in TestRail and mark regression lanes as passed or failed in the QA board in Brightfield Projects. You do not have write access to the main application repository and cannot approve pull requests. Once you sign off a regression lane, the Platform Engineering team can proceed to merge.",
    altAnswer: "Your role is to review test results in TestRail and record pass or fail in the Brightfield Projects QA board — pull request approval is outside your access scope. A signed-off regression lane is the green light for the Platform team to merge.",
    detail: 'QA sign-off workflow is documented in Brightfield Docs → Engineering → Development Process. Test results are in TestRail; sign-off status is in the Brightfield Projects QA board.',
    start: 7, end: 14,
    system: 'Docs',
    highlight: H.docsIntro,
    scene: scene('docs-article', { sidebarIndex: 3, rowIndex: -1 }),
    note: tip("If a regression lane fails, raise a Jira bug before marking it failed in TestRail so the defect is tracked from the moment it's found."),
    scopedNote: "Priya's side of this process is the pull request: she authors code, seeks peer review, and waits for Marcus's QA sign-off before merging.",
    points: 8,
  },
  {
    id: 'mw-09',
    title: 'Am I enrolled in benefits or a pension?',
    answer: "As a contractor through Meridian Staffing, you are not entitled to Brightfield's benefits or pension scheme. Any pension or healthcare queries should go to your Meridian account manager — they can explain what is included in your contractor engagement. The \"benefits enrolment\" row in your Brightfield record shows \"Managed by agency — not applicable\".",
    altAnswer: "Benefits and pension at Brightfield are for employees only — contractors go through Meridian Staffing for any such provisions. Your Brightfield People record flags the benefits row as \"Managed by agency — not applicable\". Speak to your Meridian account manager for details.",
    detail: "Benefits eligibility is recorded in Brightfield People → Benefits. Contractor records show 'Managed by agency — not applicable'. Pension and healthcare queries go to Meridian Staffing.",
    start: 2, end: 5,
    system: 'HRIS',
    highlight: H.hrisRow(4),
    scene: scene('hris-record', { sidebarIndex: 1, rowIndex: 1, typedText: 'Marcus Webb' }),
    note: NO_NOTE,
    scopedNote: "Priya auto-enrols in the company pension from day one and has 30 days to opt into healthcare and dental through Brightfield People.",
    points: 7,
  },
  {
    id: 'mw-10',
    title: "Who do I contact if I'm stuck and my supervisor's not around?",
    answer: "If Dana Whitfield is unavailable, post in #qa-team on Slack — the QA team covers UK working hours. For anything contractual or payroll-related, your Meridian Staffing account manager is the right contact, not Brightfield People Ops. For urgent IT issues, use the IT Support queue and #it-support on Slack.",
    altAnswer: "When Dana is away, #qa-team on Slack is your first stop for work questions. Contractual or financial matters go to your Meridian account manager, not Brightfield HR. Urgent IT issues use the IT Support queue and #it-support.",
    detail: "Escalation contacts are in the QA team page in Brightfield People. For contractor matters, the Meridian account manager contact is in your Meridian welcome pack.",
    start: 0, end: 90,
    system: 'Comms',
    highlight: H.commsReply,
    scene: scene('comms-thread', { sidebarIndex: 6, rowIndex: -1, typedText: 'Marcus Webb' }),
    note: NO_NOTE,
    scopedNote: "Priya escalates technical issues via #platform-eng and HR matters via #people-ops, both within Brightfield.",
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


// ─── Marcus's quiz ────────────────────────────────────────────────────────────

const marcusQuiz: Question[] = [

  // ── Day 3: Spotting and reporting security issues ─────────────────────────

  ...stampDay(3, 'Spotting and reporting security issues', [
    {
      id: 'mw-q01',
      prompt: 'You receive an email asking you to verify your Brightfield account by clicking a link. The email looks official. What should you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Report it to IT Support via #it-support and do not click the link'), opt('b','Click the link to verify your account'), opt('c','Forward it to Dana Whitfield for advice'), opt('d','Delete the email and carry on')],
      correctOptionId: 'a',
      explanation: "Brightfield IT never asks users to verify accounts by email. Reporting it to IT Support prevents the campaign from reaching others and lets the team investigate the sending domain. Forwarding to your supervisor does not address the threat and puts them at risk too.",
      altExplanation: "The right response is to report, not click. Even if the link looks benign, phishing links can execute on visit. Deleting without reporting means the campaign continues unchecked for the rest of the organisation.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '6 Aug 2026, 10:05', 'Confirmed understanding of the phishing-reporting process.'),
    },
    {
      id: 'mw-q02',
      prompt: 'As a Restricted-tier contractor, which of the following environments are you permitted to access?',
      system: 'SSO' as SourceSystem,
      options: [opt('a','Test environment only, after explicit approval through the restricted queue'), opt('b','Staging and test environments'), opt('c','All environments except live production'), opt('d','Any environment your supervisor grants verbally')],
      correctOptionId: 'a',
      explanation: "Restricted-tier contractors are limited to the test environment, and only after approval through the restricted provisioning queue. Staging and production are explicitly out of scope. Verbal permission from a supervisor does not override the security policy — access is provisioned through IT, not granted by word of mouth.",
      altExplanation: "The Restricted tier means your access is narrower than a standard employee's. The test environment requires formal approval; staging and production are off limits regardless of task urgency. IT Support, not your supervisor, controls what you can access.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('b', false, 0, '6 Aug 2026, 10:12', 'Incorrect — review the contractor access policy in Brightfield Docs.'),
    },
    {
      id: 'mw-q03',
      prompt: "You find a USB drive near the test lab with a label reading 'Build 47 — QA'. What should you do?",
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Hand it to IT Support without plugging it in'), opt('b','Plug it in — the label suggests it is a legitimate build artefact'), opt('c','Leave it in the lab in case someone returns for it'), opt('d','Log it on Slack and see if anyone claims it')],
      correctOptionId: 'a',
      explanation: "A plausible-looking label makes a USB drive more dangerous, not less — it is a common social-engineering technique to encourage people to plug in unknown devices. Handing it to IT Support untouched is the only safe response. Leaving it or logging it informally does not protect the network.",
      altExplanation: "A label that looks like it belongs in the QA lab is exactly the kind of detail an attacker would add. IT Support can check the drive safely; plugging it in yourself risks executing malware before any scan can run.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '6 Aug 2026, 10:19', 'Confirmed understanding of removable-media policy.'),
    },
    {
      id: 'mw-q04',
      kind: 'written' as const,
      prompt: "You realise you have accidentally shared a test report containing real user email addresses with an external contact. What steps should you take?",
      system: 'Docs' as SourceSystem,
      options: [],
      correctOptionId: '',
      explanation: "The document should be recalled if possible, and the Data Protection team must be informed within 24 hours with details of what was shared, with whom, and when. Because the data involved real user email addresses, a regulatory assessment may be required under UK GDPR — that is the Data Protection team's decision to make, not yours.",
      altExplanation: "Real email addresses count as personal data under UK GDPR. The 24-hour internal reporting deadline exists so the Data Protection team can assess regulatory exposure quickly. Recalling the document reduces the risk but does not substitute for the report.",
      highlight: H.quizPrompt,
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: -1, typedText: 'Marcus Webb' }),
      points: 10,
      writtenAnswer: "I would ask the external contact to delete it and let Dana know what happened.",
      modelAnswer: "Attempt to recall the document or ask the recipient to delete it, then report the incident to the Data Protection team within 24 hours, including what data was in the report, who received it and the time it was sent, so they can assess whether regulatory notification is required.",
      missedPoint: "Did not mention reporting to the Data Protection team or the 24-hour deadline — informing a supervisor is not a substitute.",
      result: result('', false, 58, '6 Aug 2026, 10:27', 'Partially completed — review the data-breach response procedure in Brightfield Docs.'),
    },
  ]),

  // ── Day 5: Leave, hours and benefits ──────────────────────────────────────

  ...stampDay(5, 'Leave, hours and benefits', [
    {
      id: 'mw-q05',
      prompt: 'You want to take a day off next week. What is the correct process for a contractor at Brightfield?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Notify Dana Whitfield per your SOW notice terms and inform your Meridian account manager'), opt('b','Submit a leave request in Brightfield Expenses → Time Off'), opt('c','Email People Ops to register the absence'), opt('d','No process needed — contractors manage their own time')],
      correctOptionId: 'a',
      explanation: "Contractor time-off is governed by the Meridian Staffing SOW, not Brightfield's leave policy. The correct process is to notify Dana Whitfield as your on-site supervisor and log the absence with your Meridian account manager for payroll. Using Brightfield Expenses will create a payroll mismatch.",
      altExplanation: "The Brightfield leave system is for employees, not contractors. Your time-off terms are in your SOW — follow those, inform Dana Whitfield, and keep Meridian in the loop for payroll accuracy.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('b', false, 0, '8 Aug 2026, 11:20', 'Incorrect — contractor leave is not managed through Brightfield Expenses. Review the contractor guide in Brightfield Docs.'),
    },
    {
      id: 'mw-q06',
      prompt: 'A Brightfield employee tells you they can carry over up to 5 days of annual leave. Does this apply to you?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','No — as a contractor your time-off terms are in your Meridian SOW, not Brightfield policy'), opt('b','Yes — the carry-over policy applies to everyone who works at Brightfield'), opt('c','Yes, but only if your contract is longer than three months'), opt('d','No — contractors receive no leave entitlement of any kind')],
      correctOptionId: 'a',
      explanation: "Brightfield's leave and carry-over policy applies to employees only. As a contractor through Meridian Staffing, your entitlements are defined in your SOW. Your Meridian account manager is the right person to ask about carry-over or accrual.",
      altExplanation: "The carry-over rule is part of Brightfield's employee leave policy, which does not extend to contractors. Your time-off entitlement — including any carry-over — is in your Meridian SOW.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 11:27', 'Confirmed understanding that Brightfield leave policy does not apply to contractors.'),
    },
    {
      id: 'mw-q07',
      prompt: 'You notice your Brightfield People record shows "Managed by agency — not applicable" under Benefits Enrolment. What does this mean?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Benefits are handled by Meridian Staffing — you are not eligible for Brightfield schemes'), opt('b','You have been missed in the enrolment cycle and should contact People Ops'), opt('c','Your benefits will activate after your 30-day enrolment window closes'), opt('d','Contractors receive a reduced benefits package configured by IT')],
      correctOptionId: 'a',
      explanation: "\"Managed by agency\" means your benefits and pension are the responsibility of Meridian Staffing, not Brightfield. There is no enrolment window for contractors in Brightfield People — the record is correct as shown. Contact your Meridian account manager for details of what is included in your contract.",
      altExplanation: "The agency flag is correct and intentional — it is not an error. Brightfield benefits are for employees; your provisions are in your Meridian contract. People Ops cannot help with contractor benefit queries.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 11:34', 'Confirmed understanding of contractor benefits status.'),
    },
    {
      id: 'mw-q08',
      prompt: 'Your three-month contract is nearing its end. Your laptop will be reclaimed by IT. By when should you back up your work files?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Before the contract end date — IT reclaim is automatic'), opt('b','After the exit interview with Dana Whitfield'), opt('c','Only files you personally created need to be backed up'), opt('d','IT will copy your files to OneDrive before reclaiming the device')],
      correctOptionId: 'a',
      explanation: "IT reclaim on contractor equipment is automatic and happens on the contract end date. You should back up anything you need to retain before that date, to OneDrive or another agreed location. IT does not copy files as part of the reclaim process — that is your responsibility.",
      altExplanation: "The reclaim is automatic, not negotiated. Waiting for an exit interview may be too late. Back up to OneDrive before the end date — IT will not migrate files for you.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '8 Aug 2026, 11:41', 'Confirmed understanding of contractor equipment reclaim process.'),
    },
  ]),

  // ── Day 9: Expenses, data handling and who to ask ─────────────────────────

  ...stampDay(9, 'Expenses, data handling and who to ask', [
    {
      id: 'mw-q09',
      prompt: 'You spend £80 on a USB hub for the test lab. How should you submit this as a contractor expense?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Via Brightfield Expenses → New Claim using the Contractor category'), opt('b','Via Brightfield Expenses → New Claim using the Employee category'), opt('c','Email the receipt to Dana Whitfield for sign-off'), opt('d','Raise a purchase request in Brightfield IT Support')],
      correctOptionId: 'a',
      explanation: "Contractor expenses go through Brightfield Expenses → New Claim using the Contractor category. The reimbursement routes to your Meridian invoice, not payroll — using the Employee category will cause a routing mismatch. Confirm the correct cost-code with your Meridian account manager before submitting.",
      altExplanation: "The Contractor category exists precisely to route reimbursement through Meridian rather than Brightfield payroll. Using the wrong category causes an invoice mismatch that will delay payment.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 15:10', 'Confirmed understanding of contractor expense submission process.'),
    },
    {
      id: 'mw-q10',
      prompt: 'Who approves a contractor expense claim of £200 submitted through Brightfield Expenses?',
      system: 'Expenses' as SourceSystem,
      options: [opt('a','Dana Whitfield, as claims above £150 route to the on-site supervisor'), opt('b','The Meridian Staffing finance team only'), opt('c','It self-approves — the £150 threshold applies to contractors too'), opt('d','Jordan Ellis, as the senior Brightfield manager on the account')],
      correctOptionId: 'a',
      explanation: "Claims above £150 route to Dana Whitfield for approval, even for contractors. The £150 threshold is the same as for employees. However, reimbursement still flows via Meridian invoice rather than payroll — Dana's sign-off is about the claim itself, not the payment route.",
      altExplanation: "The approval threshold is the same regardless of employment type: £150, with Dana Whitfield as the approver above that. The payment route differs — it goes to your Meridian invoice — but the approval workflow is identical.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 15:17', 'Confirmed understanding of contractor expense approval routing.'),
    },
    {
      id: 'mw-q11',
      prompt: 'A test dataset you are working with contains real customer names and email addresses. What should you do before using it in testing?',
      system: 'Docs' as SourceSystem,
      options: [opt('a','Raise it with Dana Whitfield and check whether an anonymised dataset is available'), opt('b','Use it — test environments are not subject to UK GDPR'), opt('c','Remove the names but keep the email addresses'), opt('d','Proceed if fewer than twenty customers are affected')],
      correctOptionId: 'a',
      explanation: "Real personal data in test environments is a UK GDPR risk regardless of the environment label. The right first step is to flag it with your supervisor and ask whether an anonymised or synthetic dataset is available. Test environments are fully in scope for data-protection rules.",
      altExplanation: "UK GDPR applies everywhere real personal data is processed — including test environments. Using real customer data without a lawful basis and appropriate safeguards is non-compliant. Raising it immediately with Dana Whitfield is the correct response.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('b', false, 0, '12 Aug 2026, 15:24', 'Incorrect — real personal data in test environments is in scope for UK GDPR. Review the data-handling policy.'),
    },
    {
      id: 'mw-q12',
      prompt: 'You have a technical question about the test environment that Dana Whitfield cannot answer. Who is the next port of call?',
      system: 'Comms' as SourceSystem,
      options: [opt('a','Post in #qa-team on Slack — the QA team covers UK working hours'), opt('b','Contact Jordan Ellis directly'), opt('c','Raise a ticket in Brightfield IT Support immediately'), opt('d','Email People Ops — they manage all contractor queries')],
      correctOptionId: 'a',
      explanation: "#qa-team on Slack is the right first escalation for technical questions when Dana is unavailable — it is monitored by the QA team during UK working hours and keeps the question visible. Jordan Ellis is on the engineering side and not the right contact for QA environment issues. People Ops handles HR, not technical queries.",
      altExplanation: "The QA Slack channel is the correct technical escalation path. Raising a ticket in IT Support is appropriate for access or hardware issues, not for technical test-environment questions. People Ops is HR only.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '12 Aug 2026, 15:31', 'Confirmed understanding of escalation channels.'),
    },
  ]),

  // ── Day 20: Requesting extra equipment ────────────────────────────────────

  ...stampDay(20, 'Requesting extra equipment', [
    {
      id: 'mw-q13',
      prompt: 'You need an additional monitor for the test lab. What is the correct process?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise a hardware request in the restricted IT Support queue for Dana Whitfield to approve'), opt('b','Buy it yourself and submit a Contractor expense claim'), opt('c','Ask a Brightfield employee to raise the ticket on your behalf'), opt('d','Order it through the Meridian Staffing procurement portal')],
      correctOptionId: 'a',
      explanation: "Hardware for Restricted-tier contractors goes through the restricted IT Support queue, where Dana Whitfield is the approver. Buying it first and claiming back bypasses the approval process and is not guaranteed to be reimbursed under the contractor equipment policy.",
      altExplanation: "The restricted queue is the correct channel — it routes differently from the standard hardware request because of the security tier. Dana Whitfield approves; IT then provisions the equipment.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 12:00', 'Confirmed understanding of the contractor hardware request process.'),
    },
    {
      id: 'mw-q14',
      prompt: 'Your request for test-environment access has been in the restricted queue for four working days with no response. What should you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Post the ticket number in #it-support on Slack and mention that it is a Restricted-tier request'), opt('b','Raise a duplicate ticket to escalate'), opt('c','Ask Dana Whitfield to grant access directly'), opt('d','Contact the security team lead personally')],
      correctOptionId: 'a',
      explanation: "Posting the ticket number in #it-support with the Restricted-tier context helps the team prioritise correctly — restricted requests have a longer SLA but should not stall indefinitely. Duplicate tickets slow things down. Dana Whitfield cannot grant environment access — that requires IT provisioning.",
      altExplanation: "#it-support is the right escalation channel. Mentioning the Restricted tier is important because it explains the longer queue time and helps IT triage the request. No shortcut exists — access must come through IT.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 12:07', 'Confirmed understanding of the restricted-tier escalation process.'),
    },
    {
      id: 'mw-q15',
      prompt: 'You need a software licence for a testing tool not currently on your Windows laptop. What is the first step?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise a software request in Brightfield IT Support — do not install software yourself'), opt('b','Download and install it from the vendor website — it is a legitimate tool'), opt('c','Ask Dana Whitfield to install it remotely'), opt('d','Contact Meridian Staffing IT to install it via the device management channel')],
      correctOptionId: 'a',
      explanation: "Software must be requested through Brightfield IT Support even on contractor devices — self-installation bypasses the security scan and may violate the acceptable-use policy. Meridian manages the device but Brightfield controls what is installed on it while it is on the corporate network.",
      altExplanation: "The correct process is a software request in IT Support. Installing software yourself — even legitimate tools — creates a security gap because the installation is not scanned or approved. Brightfield IT controls the software estate, even on contractor-owned devices.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('c', false, 0, '23 Aug 2026, 12:14', 'Incorrect — software must go through IT Support. Review the acceptable-use policy.'),
    },
    {
      id: 'mw-q16',
      prompt: 'Your Windows laptop develops a fault two weeks before your contract ends. What should you do?',
      system: 'ITSM' as SourceSystem,
      options: [opt('a','Raise an IT Support ticket and also notify your Meridian account manager — they co-manage the device'), opt('b','Contact Meridian IT only — Brightfield IT does not service contractor devices'), opt('c','Buy a replacement and submit a contractor expense claim'), opt('d','Work from a personal device for the remaining two weeks')],
      correctOptionId: 'a',
      explanation: "Contractor devices are co-managed: Brightfield IT handles the corporate software and network access; Meridian manages the hardware contract. Both need to be in the loop when a fault occurs near the contract end date. Working from a personal device is not permitted under the acceptable-use policy.",
      altExplanation: "Both parties need to know: Brightfield IT handles the software side and Meridian handles the hardware. Two weeks before reclaim is not an edge case — notify both so the device can be assessed and replaced if needed without gaps in your access.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '23 Aug 2026, 12:20', 'Confirmed understanding of contractor device fault process.'),
    },
  ]),

  // ── Day 30: Contract review prep ──────────────────────────────────────────

  ...stampDay(30, 'Contract review prep', [
    {
      id: 'mw-q17',
      prompt: "Your three-month contract is ending. You want to discuss a possible extension. Who should you contact first?",
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Your Meridian Staffing account manager — contract extensions go through the agency'), opt('b','Dana Whitfield — your on-site supervisor handles extensions'), opt('c','Brightfield People Ops — they manage all contracts'), opt('d','Jordan Ellis — they are the most senior Brightfield contact you know')],
      correctOptionId: 'a',
      explanation: "Contract extensions for agency staff are handled by Meridian Staffing, not Brightfield. Dana Whitfield can express interest in extending but the contract itself must be negotiated and renewed through Meridian. Going to Brightfield People Ops or Jordan Ellis directly will be redirected.",
      altExplanation: "The commercial relationship is between Brightfield and Meridian Staffing. Any extension must be agreed at that level. Dana Whitfield can flag the intention, but the paperwork goes through your Meridian account manager.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 10:00', 'Confirmed understanding of contract extension process.'),
    },
    {
      id: 'mw-q18',
      prompt: 'Before your contract ends, you want to keep a copy of a test plan you wrote. What is the correct approach?',
      system: 'Docs' as SourceSystem,
      options: [opt('a','Copy only the parts you are legally entitled to retain — check with Dana Whitfield and Meridian first'), opt('b','Copy everything to a personal device before the laptop is reclaimed'), opt('c','Ask IT Support to transfer all your files to a personal OneDrive'), opt('d','Test plans are Brightfield property — you cannot retain any part of them')],
      correctOptionId: 'a',
      explanation: "Intellectual property created during a contract typically belongs to the client, not the contractor. You may be entitled to retain non-proprietary reference material, but you should confirm with Dana Whitfield and your Meridian account manager what is permissible before copying anything. Copying everything without permission is a data and IP policy violation.",
      altExplanation: "The safe approach is to ask first. Work product created at Brightfield is likely their IP under the contract terms. Meridian and Dana Whitfield can tell you what you are permitted to keep before you back anything up.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 1, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 10:07', 'Confirmed understanding of IP and data retention at contract end.'),
    },
    {
      id: 'mw-q19',
      prompt: 'Your contract states a one-week notice period. You receive a verbal offer from a third party and want to leave in three days. What should you do?',
      system: 'HRIS' as SourceSystem,
      options: [opt('a','Honour the notice period — contact your Meridian account manager immediately to begin the formal process'), opt('b','Notify Dana Whitfield and leave in three days — verbal agreements override written contracts'), opt('c','Leave immediately — the notice period only applies if Brightfield terminates the contract'), opt('d','Negotiate directly with Brightfield to waive the notice period')],
      correctOptionId: 'a',
      explanation: "The written notice period in your contract is binding. Verbal agreements do not override it. The correct step is to notify Meridian Staffing, who manage the contract, and let them handle communication with Brightfield. Leaving without notice can result in legal and financial consequences.",
      altExplanation: "Notice periods are contractual obligations. The right process is to contact Meridian immediately — they are the contracting party and will manage the notice formally. Do not negotiate directly with Brightfield; that is Meridian's role.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 2, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 10:14', 'Confirmed understanding of contractor notice obligations.'),
    },
    {
      id: 'mw-q20',
      prompt: 'After your contract ends, how long will you retain access to Brightfield systems?',
      system: 'SSO' as SourceSystem,
      options: [opt('a','Access is revoked automatically on the contract end date via SSO'), opt('b','Access continues for 30 days after the end date for wrap-up tasks'), opt('c','Access continues until you are formally offboarded by Dana Whitfield'), opt('d','You retain read-only access for 90 days')],
      correctOptionId: 'a',
      explanation: "SSO-managed access for contractors is revoked automatically on the contract end date. There is no grace period for wrap-up — any outstanding tasks must be completed before that date. Dana Whitfield cannot extend access; only IT Support can, with a formal extension request and a new contract in place.",
      altExplanation: "The SSO revocation is automatic and immediate. Planning around the end date is essential — there is no 30-day grace period, and read-only access is not offered to contractors after the contract ends.",
      highlight: H.quizOption(0),
      scene: scene('quiz', { sidebarIndex: 6, focusedField: 0, rowIndex: 0, overlay: 'toast', typedText: 'Marcus Webb' }),
      points: 10,
      result: result('a', true, 100, '2 Sep 2026, 10:21', 'Confirmed understanding of access revocation at contract end.'),
    },
  ]),
]


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

// ─── Marcus's profile ─────────────────────────────────────────────────────────

const marcusPersona: Profile['persona'] = {
  id: 'marcus-webb',
  name: 'Marcus Webb',
  role: 'new-starter',
  employmentType: 'Contract (3 months)',
  team: 'Quality Assurance',
  os: 'Windows',
  location: 'Manchester',
  startDate: '3 Aug 2026',
  manager: 'Dana Whitfield',
  securityTier: 'Restricted',
  initials: 'MW',
}

const marcusMeta: SystemsMeta = {
  workspaceName:    'Brightfield',
  connectedSystems: 7,
  recordCount:      1150,
  connectionType:   'SSO + MCP',
  lastSynced:       'moments ago',
}

export const MARCUS_PROFILE: Profile = {
  persona:          marcusPersona,
  title:            'Marcus Webb',
  subtitle:         'Contract QA Tester, Quality Assurance — started 3 Aug 2026',
  programmeDays:    90,
  connectedSystems: SHARED_SYSTEMS,
  usageNotes:       USAGE_NOTES,
  specRows:         specRows(marcusPersona),
  topics:           marcusTopics,
  quiz:             marcusQuiz,
  onboardingPct:    45,
  systemsMeta:      marcusMeta,
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
