/**
 * app/api/knowledge-image/[...path]/route.ts
 * Serves image files that live inside the /knowledge folder, so screenshots can
 * sit next to the guides they belong to (e.g. knowledge/youtube/images/*.png)
 * instead of in /public.
 *
 * URL: /api/knowledge-image/youtube/images/signin-1-home.png
 *      → knowledge/youtube/images/signin-1-home.png
 *
 * Only image extensions are allowed, and the resolved path is checked to stay
 * inside /knowledge (no "../" traversal).
 */
import { NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, normalize, extname, sep } from 'path'

const KNOWLEDGE_DIR = join(process.cwd(), 'knowledge')

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
}

export function GET(
  _req: Request,
  { params }: { params: { path?: string[] } },
) {
  const rel = (params.path ?? []).join('/')
  const mime = MIME[extname(rel).toLowerCase()]
  if (!mime) {
    return new NextResponse('Unsupported file type', { status: 400 })
  }

  const full = normalize(join(KNOWLEDGE_DIR, rel))
  if (full !== KNOWLEDGE_DIR && !full.startsWith(KNOWLEDGE_DIR + sep)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  if (!existsSync(full) || !statSync(full).isFile()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const file = readFileSync(full)
  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      'Content-Type':  mime,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
