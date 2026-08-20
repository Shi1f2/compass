#!/usr/bin/env node
/**
 * scripts/provision.mjs
 * Provisions a supervisor for an organisation — new or existing.
 *
 * New organisation (first run):
 *   npm run provision -- \
 *     --org "Acme Corp" --domain "acme.com" \
 *     --email "alice@acme.com" --name "Alice Smith"
 *
 * Existing organisation (additional supervisors):
 *   npm run provision -- \
 *     --org-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
 *     --email "bob@acme.com" --name "Bob Jones"
 *
 * --org and --org-id are mutually exclusive; exactly one is required.
 * --domain is required with --org and ignored with --org-id (the domain
 * already exists on the organisation row).
 *
 * What it does:
 *  1. Creates the organisation row (--org) or looks up the existing one (--org-id).
 *  2. Creates the auth user via admin API with app_metadata: { org_id, role: 'supervisor' }.
 *  3. Inserts the profile row.
 *  4. Sends an invite email via Resend directing the supervisor to sign in at /login.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   RESEND_API_KEY, INVITE_FROM_EMAIL, NEXT_PUBLIC_SITE_URL
 * Load them from .env.local automatically if dotenv is available.
 */

import { createClient } from '@supabase/supabase-js'
import { parseArgs } from 'node:util'

// ─── Load .env.local ──────────────────────────────────────────────────────────

try {
  const { config } = await import('dotenv')
  config({ path: '.env.local' })
} catch {
  // dotenv not installed — rely on the environment having been set externally
}

// ─── Parse arguments ──────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    org:         { type: 'string' },
    'org-id':    { type: 'string' },
    domain:      { type: 'string' },
    email:       { type: 'string' },
    name:        { type: 'string' },
    'job-title': { type: 'string' },
    team:        { type: 'string' },
  },
})

const { org, domain, email, name } = values
const orgIdFlag = values['org-id']   ?? null
const jobTitle  = values['job-title'] ?? null
const teamValue = values['team']      ?? null

// ── Validate flag combinations ────────────────────────────────────────────────

if (org && orgIdFlag) {
  console.error('Error: --org and --org-id are mutually exclusive. Provide one, not both.')
  process.exit(1)
}

if (!org && !orgIdFlag) {
  console.error([
    'Error: either --org or --org-id is required.',
    '',
    'New organisation:',
    '  npm run provision -- --org <name> --domain <domain> --email <email> --name <fullname>',
    '',
    'Existing organisation:',
    '  npm run provision -- --org-id <uuid> --email <email> --name <fullname>',
  ].join('\n'))
  process.exit(1)
}

if (org && !domain) {
  console.error('Error: --domain is required when creating a new organisation (--org).')
  process.exit(1)
}

if (!email || !name) {
  console.error('Error: --email and --name are required.')
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

// ─── 1. Resolve organisation ──────────────────────────────────────────────────

let orgId
let orgName
let orgDomain

if (org) {
  // Create a new organisation.
  console.log(`Creating organisation "${org}" (${domain})…`)

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: org, domain: domain.toLowerCase() })
    .select('id, name, domain')
    .single()

  if (orgErr) {
    console.error('Failed to create organisation:', orgErr.message)
    process.exit(1)
  }

  orgId     = orgRow.id
  orgName   = orgRow.name
  orgDomain = orgRow.domain
  console.log(`  ✓ Organisation created: ${orgId}`)

} else {
  // Look up an existing organisation by id.
  console.log(`Looking up organisation ${orgIdFlag}…`)

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, domain')
    .eq('id', orgIdFlag)
    .maybeSingle()

  if (orgErr) {
    console.error('Failed to query organisations:', orgErr.message)
    process.exit(1)
  }

  if (!orgRow) {
    console.error(`No organisation found with id "${orgIdFlag}". Check the UUID and try again.`)
    process.exit(1)
  }

  orgId     = orgRow.id
  orgName   = orgRow.name
  orgDomain = orgRow.domain
  console.log(`  ✓ Organisation found: ${orgName} (${orgDomain})`)
}

// ─── 2. Create auth user ──────────────────────────────────────────────────────

console.log(`Creating auth user for ${email}…`)

const { data: created, error: userErr } = await supabase.auth.admin.createUser({
  email,
  app_metadata: {
    org_id: orgId,
    role:   'supervisor',
  },
  email_confirm: true,
})

if (userErr) {
  console.error('Failed to create auth user:', userErr.message)
  process.exit(1)
}

const userId = created.user.id
console.log(`  ✓ Auth user created: ${userId}`)

// ─── 3. Insert profile row ────────────────────────────────────────────────────

console.log('Writing profile row…')

const { error: profileErr } = await supabase.from('profiles').insert({
  id:            userId,
  org_id:        orgId,
  role:          'supervisor',
  full_name:     name,
  supervisor_id: null,
  job_title:     jobTitle,
  team:          teamValue,
})

if (profileErr) {
  console.error('Failed to insert profile:', profileErr.message)
  // Attempt rollback — only delete the org row when we just created it.
  await supabase.auth.admin.deleteUser(userId)
  if (org) await supabase.from('organizations').delete().eq('id', orgId)
  process.exit(1)
}

console.log('  ✓ Profile written')

// ─── 4. Send invite email ─────────────────────────────────────────────────────

console.log('Sending invite email…')

const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const resendKey   = process.env.RESEND_API_KEY
const fromAddress = process.env.INVITE_FROM_EMAIL

if (!resendKey || !fromAddress) {
  console.error('RESEND_API_KEY and INVITE_FROM_EMAIL must be set in .env.local')
  process.exit(1)
}

const emailRes = await fetch('https://api.resend.com/emails', {
  method:  'POST',
  headers: {
    Authorization:  `Bearer ${resendKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from:    fromAddress,
    to:      email,
    subject: `You've been set up on Compass`,
    text: [
      `${orgName} has set up a Compass account for you as a supervisor.`,
      ``,
      `Go to ${siteUrl}/login, enter this address, and we'll send you a sign-in code.`,
    ].join('\n'),
  }),
})

if (!emailRes.ok) {
  const body = await emailRes.text()
  console.error(`  ✗ Resend returned ${emailRes.status}: ${body}`)
  process.exit(1)
}

console.log('  ✓ Invite email sent')

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`
Provisioning complete.
  Organisation : ${orgName} (${orgDomain})
  Org ID       : ${orgId}
  Supervisor   : ${name} <${email}>
  Auth user ID : ${userId}
  ${jobTitle  ? `Job title    : ${jobTitle}`  : ''}
  ${teamValue ? `Team         : ${teamValue}` : ''}

The supervisor can now sign in at ${siteUrl}/login.
To add another supervisor to this org:
  npm run provision -- --org-id ${orgId} --email <email> --name <fullname>
`)
