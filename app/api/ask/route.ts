/**
 * app/api/ask/route.ts
 * Retrieval-grounded answer endpoint.
 *
 * Flow: the model receives every knowledge topic's guide text AND a catalog of
 * that topic's screenshots (id + description). It analyses the question, answers
 * from the guides, and returns ordered steps where each step may name the image
 * id that illustrates it. We resolve those ids to real image URLs and return
 * { steps: [{ text, image?, url? }] }.
 *
 * Steps with no static image get a url from the topic's pageUrls map so the
 * user can open the relevant page themselves.
 *
 * Uses watsonx.ai inference API. Required .env vars:
 *   WATSONX_API_KEY    — IBM Cloud API key
 *   WATSONX_PROJECT_ID — watsonx project ID
 *   WATSONX_URL        — regional base URL, e.g. https://eu-gb.ml.cloud.ibm.com
 *   WATSONX_MODEL      — optional, defaults to meta-llama/llama-3-3-70b-instruct
 */
import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { AnswerStep } from '@/lib/guideTypes'

// ─── Persona ──────────────────────────────────────────────────────────────────

interface PersonaContext {
  name?: string; role?: string; team?: string; os?: string; location?: string
  startDate?: string; manager?: string; securityTier?: string; employmentType?: string
}

interface AskBody {
  query?:   string
  persona?: PersonaContext
}

// ─── Knowledge topics ─────────────────────────────────────────────────────────
// One folder per topic under /knowledge, e.g. knowledge/youtube/. Each has any
// number of .md guide files (context) and an optional manifest.json listing its
// screenshots. Read fresh each request so edits need no restart.

interface TopicImage { id: string; file: string; alt: string }
interface Topic {
  slug:           string
  title:          string
  description:    string
  guide:          string
  images:         TopicImage[]
  defaultPageUrl: string | null
  pageUrls:       Record<string, string>
}

const KNOWLEDGE_DIR = join(process.cwd(), 'knowledge')

function loadTopics(): Topic[] {
  let entries: import('fs').Dirent[]
  try {
    entries = readdirSync(KNOWLEDGE_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const topics: Topic[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir  = join(KNOWLEDGE_DIR, entry.name)
    const slug = entry.name

    // Guide text = every .md file in the folder, concatenated.
    const guide = readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.md'))
      .sort()
      .map(f => readFileSync(join(dir, f), 'utf8').trim())
      .filter(Boolean)
      .join('\n\n')

    // Image catalog + page URLs from manifest.json (optional).
    let title = slug, description = '', images: TopicImage[] = []
    let defaultPageUrl: string | null = null
    let pageUrls: Record<string, string> = {}
    const manifestPath = join(dir, 'manifest.json')
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
        title          = m.title          ?? slug
        description    = m.description    ?? ''
        defaultPageUrl = m.defaultPageUrl ?? null
        pageUrls       = (m.pageUrls && typeof m.pageUrls === 'object') ? m.pageUrls : {}
        images = Array.isArray(m.images)
          ? m.images.filter((i: TopicImage) => i && i.id && i.file)
          : []
      } catch { /* ignore malformed manifest */ }
    }

    if (guide || images.length) topics.push({ slug, title, description, guide, images, defaultPageUrl, pageUrls })
  }
  return topics
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function personaLine(p: PersonaContext = {}): string {
  const parts = [
    p.name && `name ${p.name}`, p.role && `role ${p.role}`,
    p.team && `team ${p.team}`, p.os && `device ${p.os}`,
    p.location && `location ${p.location}`, p.securityTier && `security tier ${p.securityTier}`,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'no specific details'
}

// A stable id the model uses to reference an image: "<topic>:<imageId>".
function catalogId(topicSlug: string, imageId: string): string {
  return `${topicSlug}:${imageId}`
}

function buildSystemPrompt(topics: Topic[], persona: PersonaContext = {}): string {
  const guides = topics
    .map(t => `## Topic: ${t.slug} — ${t.title}\n${t.description}\n\n${t.guide}`)
    .join('\n\n---\n\n')

  const catalog = topics.flatMap(t =>
    t.images.map(img => `- ${catalogId(t.slug, img.id)} — ${img.alt}`),
  ).join('\n') || '(no screenshots available)'

  return [
    'You are Compass, a guide that teaches people how to use these products.',
    '',
    'Analyse the question, find the relevant topic in the REFERENCE GUIDES, and',
    'answer using only that material — exact button names, menu paths and steps.',
    'If the guides do not cover it, say so instead of inventing details.',
    '',
    'Return your answer as an ordered list of short steps.',
    'For each step, if one of the AVAILABLE SCREENSHOTS clearly illustrates it,',
    'set "imageId" to that screenshot\'s id exactly as listed. Otherwise set "imageId" to null.',
    'Only use ids from the catalog. Do not repeat the same id on multiple steps.',
    'Keep each step to one or two sentences. No markdown headings or bullet symbols.',
    '',
    'You MUST respond with ONLY a raw JSON object — no markdown, no code fences,',
    'no explanation, no text before or after. The JSON must have this exact shape:',
    '{"steps":[{"text":"...","imageId":"...or null"},...]}',
    '',
    `Person you are helping: ${personaLine(persona)}.`,
    '',
    '===== REFERENCE GUIDES =====',
    guides || '(no guides loaded)',
    '===== END REFERENCE GUIDES =====',
    '',
    '===== AVAILABLE SCREENSHOTS (imageId — what it shows) =====',
    catalog,
    '===== END SCREENSHOTS =====',
  ].join('\n')
}

// ─── URL picker ───────────────────────────────────────────────────────────────
// Returns the best URL for a step by matching keywords in the step text + query
// against the topic's pageUrls map. Falls back to defaultPageUrl.

function pickUrlForStep(topic: Topic, stepText: string, userQuery: string): string | null {
  const haystack = (stepText + ' ' + userQuery).toLowerCase()
  for (const [key, url] of Object.entries(topic.pageUrls)) {
    if (haystack.includes(key)) return url
  }
  return topic.defaultPageUrl
}

// ─── IAM token ────────────────────────────────────────────────────────────────

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token'

async function getIamToken(apiKey: string): Promise<string> {
  const res = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey:     apiKey,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`IAM token exchange failed (${res.status}): ${detail}`)
  }
  const data = await res.json()
  return data.access_token as string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey    = process.env.WATSONX_API_KEY?.trim()
  const projectId = process.env.WATSONX_PROJECT_ID?.trim()
  const baseUrl   = process.env.WATSONX_URL?.trim() || 'https://eu-gb.ml.cloud.ibm.com'

  if (!apiKey) {
    return NextResponse.json(
      { error: 'WATSONX_API_KEY is not set. Paste your key into .env and restart the dev server.' },
      { status: 500 },
    )
  }
  if (!projectId) {
    return NextResponse.json(
      { error: 'WATSONX_PROJECT_ID is not set. Paste your project ID into .env and restart the dev server.' },
      { status: 500 },
    )
  }

  let body: AskBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const query = body.query?.trim()
  if (!query) {
    return NextResponse.json({ error: 'Missing "query".' }, { status: 400 })
  }

  const topics = loadTopics()

  // Map every catalog id → resolvable image URL.
  const imageById = new Map<string, { src: string; alt: string }>()
  for (const t of topics) {
    for (const img of t.images) {
      imageById.set(catalogId(t.slug, img.id), {
        src: `/api/knowledge-image/${t.slug}/${img.file}`,
        alt: img.alt,
      })
    }
  }

  const model = process.env.WATSONX_MODEL?.trim() || 'meta-llama/llama-3-3-70b-instruct'
  const wxUrl = `${baseUrl}/ml/v1/text/chat?version=2024-05-13`

  let iamToken: string
  try {
    iamToken = await getIamToken(apiKey)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to obtain IAM token.', detail: String(err) },
      { status: 502 },
    )
  }

  try {
    const res = await fetch(wxUrl, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${iamToken}`,
      },
      body: JSON.stringify({
        model_id:   model,
        project_id: projectId,
        messages: [
          { role: 'system', content: buildSystemPrompt(topics, body.persona) },
          { role: 'user',   content: query },
        ],
        parameters: {
          temperature: 0.3,
          response_format: { type: 'json_object' },
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json(
        { error: `watsonx API request failed (${res.status}).`, detail },
        { status: 502 },
      )
    }

    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'watsonx API returned no answer.' }, { status: 502 })
    }

    // Extract JSON — model may wrap it in markdown code fences.
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr   = jsonMatch ? jsonMatch[1].trim() : content.trim()
    const parsed    = JSON.parse(jsonStr) as {
      steps?: { text: string; imageId: string | null }[]
    }
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : []

    // Find which topic this query belongs to.
    const matchedTopic =
      topics.find(t => rawSteps.some(s => s.imageId?.startsWith(t.slug + ':'))) ??
      topics.find(t => query.toLowerCase().includes(t.slug.toLowerCase()) ||
                       query.toLowerCase().includes(t.title.toLowerCase())) ??
      topics[0] ?? null

    const usedImages = new Set<string>()

    const steps: AnswerStep[] = rawSteps
      .filter(s => typeof s.text === 'string' && s.text.trim())
      .map(s => {
        const step: AnswerStep = { text: s.text.trim() }

        // Static image from catalog — wins if available.
        if (s.imageId && imageById.has(s.imageId) && !usedImages.has(s.imageId)) {
          usedImages.add(s.imageId)
          step.image = imageById.get(s.imageId)
        }

        // Link URL from the topic's pageUrls map — shown on every step so the
        // user always has a direct link to the relevant page.
        if (matchedTopic) {
          const url = pickUrlForStep(matchedTopic, s.text, query)
          if (url) step.url = url
        }

        return step
      })

    if (steps.length === 0) {
      return NextResponse.json({ error: 'watsonx API returned an empty answer.' }, { status: 502 })
    }

    return NextResponse.json({ steps })
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach watsonx API.', detail: String(err) },
      { status: 502 },
    )
  }
}
