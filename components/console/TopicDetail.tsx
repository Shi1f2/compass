/**
 * components/console/TopicDetail.tsx
 * Full-height scrolling view for one resolved topic.
 */
'use client'

import type { Topic } from '@/lib/types'
import type { ConsoleAction } from '@/lib/consoleState'
import { dayLabel } from '@/lib/format'
import AnswerCarousel from './AnswerCarousel'

interface TopicDetailProps {
  topic:    Topic
  query:    string
  dispatch: (a: ConsoleAction) => void
  onReport: () => void
}

export default function TopicDetail({ topic, query, dispatch, onReport }: TopicDetailProps) {
  return (
    <div
      className="thin-scroll"
      style={{
        flex:       1,
        overflowY:  'auto',
        height:     '100%',
      }}
    >
      <div
        style={{
          maxWidth:  820,
          margin:    '0 auto',
          padding:   '36px 32px',
        }}
      >
        {/* Top metadata row */}
        <div
          style={{
            display:        'flex',
            alignItems:     'baseline',
            justifyContent: 'space-between',
            marginBottom:   8,
            gap:            16,
            flexWrap:       'wrap',
          }}
        >
          <span className="section-label">You asked</span>
          <span
            style={{
              fontSize:           11,
              color:              'var(--color-ink-muted)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace:         'nowrap',
            }}
          >
            {dayLabel(topic.start)} &middot; {topic.system}
          </span>
        </div>

        {/* Raw query */}
        <h2
          style={{
            margin:     '0 0 28px',
            fontSize:   20,
            fontWeight: 600,
            lineHeight: 1.2,
            color:      'var(--color-ink)',
          }}
        >
          {query}
        </h2>

        {/* Answer carousel */}
        <AnswerCarousel topic={topic} dispatch={dispatch} onReport={onReport} />
      </div>
    </div>
  )
}
