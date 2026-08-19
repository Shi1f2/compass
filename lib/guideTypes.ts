/**
 * lib/guideTypes.ts
 * Shared shapes for a live "Ask Compass" answer. The model returns ordered
 * steps; each step may carry one image the model chose to illustrate it.
 */

export interface AnswerImage {
  src: string
  alt: string
}

export interface AnswerStep {
  text:   string
  image?: AnswerImage
}
