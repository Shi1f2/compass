/**
 * lib/onboarding.ts
 * Single source of truth for the onboarding programme task data.
 * Both the supervisor detail view and the new starter view import from here
 * so their counts can never disagree.
 *
 * No runtime state lives here — components own their own checked/unchecked
 * state and initialise it from these records on mount. Reloading resets to
 * the seeded done values, which is correct for a demo with no persistence.
 */

export interface ProgramTask {
  name:     string
  done:     boolean
  /**
   * Static days-until-due value. Never computed from Date.now() — the demo
   * must not drift as real time passes. Negative means overdue.
   */
  daysLeft: number
}

export interface ProgramTopic {
  id:        number
  title:     string
  /** When true the task is compliance-tracked; show a shield badge */
  evidence?: boolean
  tasks:     ProgramTask[]
}

export const PROGRAMME: ProgramTopic[] = [
  {
    // Topic 1 — already done; deadlines are past but tasks are complete.
    // One task is overdue (daysLeft < 0) to make that state visible in the demo.
    id: 1,
    title: 'IT access and device setup',
    tasks: [
      { name: 'Enrol laptop in MDM',                   done: true,  daysLeft: -3 },
      { name: 'Configure VPN and SSO',                 done: true,  daysLeft: 1  },
      { name: 'Set up MFA and password manager',       done: true,  daysLeft: 3  },
      { name: 'Request role based system permissions', done: true,  daysLeft: 5  },
    ],
  },
  {
    id: 2,
    title: 'Information security and data protection',
    evidence: true,
    tasks: [
      { name: 'Complete GDPR awareness module',         done: true,  daysLeft: 6  },
      { name: 'Data classification and handling rules', done: true,  daysLeft: 7  },
      { name: 'Phishing simulation',                    done: true,  daysLeft: 8  },
      { name: 'Incident reporting procedure',           done: true,  daysLeft: 10 },
      { name: 'Acceptable use policy sign off',         done: true,  daysLeft: 12 },
    ],
  },
  {
    // Topic 3 is in progress — tight deadlines so urgency is visible.
    id: 3,
    title: 'Company policy and compliance',
    evidence: true,
    tasks: [
      { name: 'Code of conduct',                        done: true,  daysLeft: 14 },
      { name: 'Anti bribery and conflicts of interest', done: true,  daysLeft: 16 },
      { name: 'Health and safety briefing',             done: false, daysLeft: 2  },
      { name: 'Expenses and travel policy',             done: false, daysLeft: 4  },
    ],
  },
  {
    id: 4,
    title: 'Core systems and ways of working',
    tasks: [
      { name: 'CRM walkthrough',                        done: false, daysLeft: 18 },
      { name: 'Ticketing and escalation paths',         done: false, daysLeft: 22 },
      { name: 'Project tracker and reporting cadence',  done: false, daysLeft: 26 },
      { name: 'Document archive and naming conventions',done: false, daysLeft: 30 },
      { name: 'Approval chain for client facing work',  done: false, daysLeft: 34 },
    ],
  },
  {
    id: 5,
    title: 'Client confidentiality and engagement rules',
    evidence: true,
    tasks: [
      { name: 'NDA and confidentiality obligations',    done: false, daysLeft: 42 },
      { name: 'Client communication standards',         done: false, daysLeft: 50 },
      { name: 'Shadow a live client call',              done: false, daysLeft: 56 },
    ],
  },
  {
    id: 6,
    title: 'First supervised delivery',
    tasks: [
      { name: 'Scoped task with supervisor review',     done: false, daysLeft: 62 },
      { name: 'Peer review of output',                  done: false, daysLeft: 68 },
      { name: 'Retrospective with supervisor',          done: false, daysLeft: 74 },
      { name: 'Sign off on independent working',        done: false, daysLeft: 80 },
    ],
  },
]

/** Derive the state of a topic from its task list. */
export function topicState(
  tasks: ProgramTask[],
): 'complete' | 'in-progress' | 'not-started' {
  const done = tasks.filter(t => t.done).length
  if (done === tasks.length) return 'complete'
  if (done > 0)              return 'in-progress'
  return 'not-started'
}

/** Total number of tasks across the whole programme. */
export function programmeTotalTasks(): number {
  return PROGRAMME.reduce((s, t) => s + t.tasks.length, 0)
}

/**
 * Number of tasks seeded as done in the shared programme data.
 * Components that own local checked-state should compute this themselves
 * from their own copy; this is for read-only supervisor views that always
 * show the seeded snapshot.
 */
export function programmeDoneTasks(): number {
  return PROGRAMME.reduce((s, t) => s + t.tasks.filter(x => x.done).length, 0)
}

/** Checklist completion percentage (0–100, whole number) derived from PROGRAMME. */
export function programmeCompletionPct(): number {
  const total = programmeTotalTasks()
  if (total === 0) return 0
  return Math.round((programmeDoneTasks() / total) * 100)
}
