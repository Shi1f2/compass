/**
 * app/api/ask/route.ts
 * Retrieval-grounded answer endpoint.
 *
 * Flow: the model receives every knowledge topic's guide text AND a catalog of
 * that topic's screenshots (id + description). It analyses the question, answers
 * from the guides, and returns ordered steps where each step may name the image
 * id that illustrates it. We resolve those ids to real image URLs and return
 * { steps: [{ text, image? }] }.
 *
 * The OpenAI key lives in .env (OPENAI_API_KEY) and is read on the server only.
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

// ─── Knowledge topics ───────────────────────────────────────────────────────
// One folder per topic under /knowledge, e.g. knowledge/youtube/. Each has any
// number of .md guide files (context) and an optional manifest.json listing its
// screenshots. Read fresh each request so edits need no restart.

interface TopicImage { id: string; file: string; alt: string }
interface Topic {
  slug:        string
  title:       string
  description: string
  guide:       string
  images:      TopicImage[]
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

    // Image catalog from manifest.json (optional).
    let title = slug, description = '', images: TopicImage[] = []
    const manifestPath = join(dir, 'manifest.json')
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
        title       = m.title       ?? slug
        description  = m.description ?? ''
        images = Array.isArray(m.images)
          ? m.images.filter((i: TopicImage) => i && i.id && i.file)
          : []
      } catch { /* ignore malformed manifest */ }
    }

    if (guide || images.length) topics.push({ slug, title, description, guide, images })
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
    'Return your answer as an ordered list of short steps. For any step that one',
    'of the AVAILABLE SCREENSHOTS clearly illustrates, set imageId to that',
    "screenshot's id (exactly as written in the catalog). If no screenshot fits a",
    'step, set imageId to null. Only use ids from the catalog. Do not repeat the',
    'same screenshot on multiple steps. Keep each step to one or two sentences and',
    'do not use markdown headings or bullet symbols.',
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

// Structured-output schema: the model MUST return this shape.
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['steps'],
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'imageId'],
        properties: {
          text:    { type: 'string' },
          imageId: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set. Paste your key into .env and restart the dev server.' },
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

  // Map every catalog id -> resolvable image, for turning the model's picks into URLs.
  const imageById = new Map<string, { src: string; alt: string }>()
  for (const t of topics) {
    for (const img of t.images) {
      imageById.set(catalogId(t.slug, img.id), {
        src: `/api/knowledge-image/${t.slug}/${img.file}`,
        alt: img.alt,
      })
    }
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: buildSystemPrompt(topics, body.persona) },
          { role: 'user',   content: query },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'guide_answer', strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json(
        { error: `OpenAI request failed (${res.status}).`, detail },
        { status: 502 },
      )
    }

    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'OpenAI returned no answer.' }, { status: 502 })
    }

    const parsed = JSON.parse(content) as { steps?: { text: string; imageId: string | null }[] }
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : []

    // Resolve image ids -> URLs; drop unknown ids and de-duplicate images so the
    // same screenshot never appears twice.
    const usedImages = new Set<string>()
    const steps: AnswerStep[] = rawSteps
      .filter(s => typeof s.text === 'string' && s.text.trim())
      .map(s => {
        const step: AnswerStep = { text: s.text.trim() }
        if (s.imageId && imageById.has(s.imageId) && !usedImages.has(s.imageId)) {
          usedImages.add(s.imageId)
          step.image = imageById.get(s.imageId)
        }
        return step
      })

    if (steps.length === 0) {
      return NextResponse.json({ error: 'OpenAI returned an empty answer.' }, { status: 502 })
    }

    return NextResponse.json({ steps })
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach OpenAI.', detail: String(err) },
      { status: 502 },
    )
  }
}
