/**
 * app/api/log-question/route.ts
 * Fire-and-forget endpoint: receives a user question, asks watsonx to assign
 * a category, then inserts a row into public.user_questions.
 *
 * The categorisation prompt instructs the model to group semantically similar
 * problems under the same short key (e.g. two "can't find the sign-up button"
 * phrasings → category "signup_issues", label "Sign-up issues").
 *
 * Called by the client after a successful /api/ask response; failures here are
 * silently swallowed so they never degrade the user experience.
 *
 * Required .env vars (shared with /api/ask):
 *   WATSONX_API_KEY
 *   WATSONX_PROJECT_ID
 *   WATSONX_URL        (optional, defaults to eu-gb)
 *   WATSONX_MODEL      (optional)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { CleanDatabase } from '@/lib/database.types'

// ─── Request body ─────────────────────────────────────────────────────────────

interface LogBody {
  question:    string
  userId:      string
  orgId:       string
  sourceTopic?: string   // knowledge folder slug that answered, e.g. "youtube"
}

// ─── IAM token exchange (same helper as /api/ask) ────────────────────────────

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token'

async function getIamToken(apiKey: string): Promise<string> {
  const res = await fetch(IAM_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey:     apiKey,
    }),
  })
  if (!res.ok) throw new Error(`IAM (${res.status})`)
  const data = await res.json()
  return data.access_token as string
}

// ─── Categorisation prompt ────────────────────────────────────────────────────

const CATEGORISE_SYSTEM = `You are a UX analyst. Classify the user question into a short, reusable problem category.

Rules:
- Group semantically similar issues under the same category key regardless of wording.
  Example: "I can't find the sign-up button" and "the sign-up button is hard to see"
  both belong to category key "signup_issues" with label "Sign-up issues".
- The category key must be snake_case, max 40 chars, no spaces.
- The category label must be title-case, human-readable, max 50 chars.
- If the question is general knowledge (e.g. "How do I reset my password?") and not
  specifically about a UI problem, use category key "general_help" / label "General Help".

Respond with ONLY a raw JSON object — no markdown, no code fences:
{"category":"<snake_case_key>","category_label":"<Human Label>"}`

async function categoriseQuestion(
  question: string,
  apiKey: string,
  projectId: string,
  baseUrl: string,
  model: string,
): Promise<{ category: string; category_label: string }> {
  const iamToken = await getIamToken(apiKey)
  const wxUrl    = `${baseUrl}/ml/v1/text/chat?version=2024-05-13`

  const res = await fetch(wxUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${iamToken}`,
    },
    body: JSON.stringify({
      model_id:   model,
      project_id: projectId,
      messages: [
        { role: 'system', content: CATEGORISE_SYSTEM },
        { role: 'user',   content: question },
      ],
      parameters: {
        temperature:     0.1,
        max_new_tokens:  80,
        response_format: { type: 'json_object' },
      },
    }),
  })

  if (!res.ok) throw new Error(`watsonx (${res.status})`)

  const data    = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('empty model response')

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr   = jsonMatch ? jsonMatch[1].trim() : content.trim()
  const parsed    = JSON.parse(jsonStr) as { category?: string; category_label?: string }

  const category       = (parsed.category       ?? 'uncategorised').slice(0, 40)
  const category_label = (parsed.category_label ?? 'Uncategorised').slice(0, 50)
  return { category, category_label }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: LogBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { question, userId, orgId, sourceTopic } = body
  if (!question || !userId || !orgId) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const apiKey    = process.env.WATSONX_API_KEY?.trim()
  const projectId = process.env.WATSONX_PROJECT_ID?.trim()
  const baseUrl   = process.env.WATSONX_URL?.trim() || 'https://eu-gb.ml.cloud.ibm.com'
  const model     = process.env.WATSONX_MODEL?.trim() || 'meta-llama/llama-3-3-70b-instruct'

  const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase service role not configured.' }, { status: 500 })
  }

  // Categorise — if watsonx is not configured, fall back gracefully.
  let category       = 'uncategorised'
  let category_label = 'Uncategorised'

  if (apiKey && projectId) {
    try {
      const result = await categoriseQuestion(question, apiKey, projectId, baseUrl, model)
      category       = result.category
      category_label = result.category_label
    } catch {
      // Categorisation failure is non-fatal — we still log the question.
    }
  }

  // Persist using the service-role client (bypasses RLS so we can write from
  // the server without an authenticated cookie belonging to the user).
  const supabase = createServiceClient<CleanDatabase>(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase.from('user_questions').insert({
    org_id:         orgId,
    user_id:        userId,
    question,
    category,
    category_label,
    source_topic:   sourceTopic ?? null,
  })

  if (error) {
    console.error('[log-question] insert failed:', error.code, error.message, error.details, { userId, orgId })
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 })
  }

  return NextResponse.json({ ok: true, category, category_label })
}
