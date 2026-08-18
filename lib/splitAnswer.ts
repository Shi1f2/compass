/**
 * lib/splitAnswer.ts
 * Splits a topic's answer into sequential steps for the Mentor tab's swipe
 * view. Sentences double as steps and a short title is lifted from the front
 * of each one. Derived at render time; never stored, so the regenerate action
 * (which swaps in the alternate wording) keeps working with no extra data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Step {
  title: string
  text: string
}

// ─── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'than', 'that',
  'the', 'their', 'to', 'too', 'under', 'via', 'with', 'without', 'so', 'not',
])

// ─── Title derivation ─────────────────────────────────────────────────────────

/**
 * Derives a short title from a single sentence by finding a natural break
 * point or taking the first few meaningful words.
 */
function deriveTitle(sentence: string): string {
  // Strip parenthesised spans, collapse runs of whitespace, trim
  let s = sentence
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Remove trailing sentence-ending punctuation
  s = s.replace(/[.!?]+$/, '')

  // Strip trailing comma / semicolon / colon and return if already short enough
  const stripped = s.replace(/[,;:]+$/, '').replace(/"/g, '')
  const words = stripped.split(' ').filter(Boolean)
  if (stripped.length <= 46 || words.length <= 8) {
    return stripped
  }

  // Look for a natural break point between index 14 and 55
  const breakPatterns: [RegExp, number][] = [
    [/ — /g, 0],
    [/, /g, 0],
    [/; /g, 0],
  ]

  for (const [pattern] of breakPatterns) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(s)) !== null) {
      const idx = match.index
      if (idx >= 14 && idx <= 55) {
        return s.slice(0, idx).replace(/[,;:]+$/, '').replace(/"/g, '')
      }
    }
  }

  // Take the first 6 words, extending past stopwords (max 8)
  let take = 6
  while (take < 8 && take < words.length && STOPWORDS.has(words[take - 1].toLowerCase())) {
    take++
  }

  return words.slice(0, take).join(' ').replace(/[,;:]+$/, '').replace(/"/g, '')
}

// ─── Splitter ─────────────────────────────────────────────────────────────────

/**
 * Splits an answer string into steps, one per sentence.
 *
 * A single-sentence answer yielding a single step is a perfectly ordinary
 * result. The carousel that consumes this renders one step exactly the way it
 * renders five, so there is no "too short to split" case for callers to handle.
 */
export function splitAnswer(text: string): Step[] {
  // Match sentences ending in . ! or ? plus any trailing run without terminator
  const sentenceRe = /[^.!?]+[.!?]+|[^.!?]+$/g
  const matches = text.match(sentenceRe)

  if (!matches) {
    return [{ title: 'Answer', text: text.trim() }]
  }

  const sentences = matches.map(s => s.trim()).filter(Boolean)

  if (sentences.length === 0) {
    return [{ title: 'Answer', text: text.trim() }]
  }

  return sentences.map(sentence => ({
    title: deriveTitle(sentence),
    text: sentence,
  }))
}
