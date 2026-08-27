/**
 * lib/guideTypes.ts
 * Shared shapes for a live "Ask Compass" answer. The model returns ordered
 * steps; each step may carry one image the model chose to illustrate it,
 * and/or a URL the user can open to follow along.
 */

export interface AnswerImage {
  src: string
  alt: string
}

export interface AnswerStep {
  text:   string
  /** A static image from the knowledge folder served by /api/knowledge-image. */
  image?: AnswerImage
  /** A URL the user can open to follow this step (e.g. youtube.com, studio.youtube.com). */
  url?:   string
}
