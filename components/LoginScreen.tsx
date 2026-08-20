/**
 * components/LoginScreen.tsx
 * Two-step OTP sign-in: email → 6-digit code.
 * Invite-only: only provisioned accounts receive a code.
 * Role is read from the account after sign-in, never chosen here.
 */
'use client'

import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { Lockup } from '@/components/Wordmark'
import { TRACED_ACCENT, TRACED_SURFACE, TRACED_INK, TRACED_HIGHLIGHT } from '@/components/tracedIllustration'
import { sendOtp, verifyOtp } from '@/lib/auth-actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const CODE_LENGTH     = 6
const RESEND_COOLDOWN = 30_000 // 30 s

// ─── Email validation ─────────────────────────────────────────────────────────

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Sparkle star helper ──────────────────────────────────────────────────────

function Sparkle({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const p = size * 0.18
  return (
    <path
      transform={`translate(${x},${y})`}
      d={`M0,-${size} C${p},-${p} ${p},-${p} ${size},0 C${p},${p} ${p},${p} 0,${size} C-${p},${p} -${p},${p} -${size},0 C-${p},-${p} -${p},-${p} 0,-${size}Z`}
      fill={color}
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const [step,        setStep]        = useState<'email' | 'code'>('email')
  const [email,       setEmail]       = useState('')
  const [emailError,  setEmailError]  = useState('')
  const [code,        setCode]        = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [codeError,   setCodeError]   = useState('')
  const [resendAt,    setResendAt]    = useState<number | null>(null)
  const [resendLabel, setResendLabel] = useState('')

  const [isPendingSend,   startSend]   = useTransition()
  const [isPendingVerify, startVerify] = useTransition()

  const emailRef      = useRef<HTMLInputElement>(null)
  const codeRefs      = useRef<(HTMLInputElement | null)[]>([])
  const activeStepRef = useRef<HTMLDivElement>(null)
  const [stackHeight, setStackHeight] = useState<number | undefined>(undefined)

  // ── Height measurement ────────────────────────────────────────────────────

  useEffect(() => {
    const el = activeStepRef.current
    if (!el) return
    const update = () => setStackHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [step])

  // ── Focus management on step change ──────────────────────────────────────

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (step === 'code') {
        codeRefs.current[0]?.focus()
      } else {
        emailRef.current?.focus()
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [step])

  // ── Resend cooldown ticker ────────────────────────────────────────────────

  useEffect(() => {
    if (resendAt === null) return
    const tick = () => {
      const remaining = Math.ceil((resendAt - Date.now()) / 1000)
      if (remaining <= 0) {
        setResendLabel('')
        setResendAt(null)
      } else {
        setResendLabel(`Resend in ${remaining}s`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [resendAt])

  // ── Code fill helper ──────────────────────────────────────────────────────

  const fillCode = useCallback((chars: string, fromIndex: number) => {
    setCode(prev => {
      const next = [...prev]
      let ci = fromIndex
      for (const ch of chars) {
        if (ci >= CODE_LENGTH) break
        next[ci++] = ch
      }
      return next
    })
    const focusIdx = Math.min(fromIndex + chars.length, CODE_LENGTH - 1)
    requestAnimationFrame(() => codeRefs.current[focusIdx]?.focus())
  }, [])

  // ── Send code ─────────────────────────────────────────────────────────────

  const handleSendCode = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!emailRe.test(email)) {
      setEmailError('Enter a work email address.')
      return
    }
    setEmailError('')
    startSend(async () => {
      await sendOtp(email)
      // Always advance — never reveal whether the address is registered.
      setStep('code')
      setResendAt(Date.now() + RESEND_COOLDOWN)
    })
  }, [email])

  // ── Verify ────────────────────────────────────────────────────────────────

  const handleVerify = useCallback((e: FormEvent) => {
    e.preventDefault()
    const token = code.join('')
    setCodeError('')
    startVerify(async () => {
      const result = await verifyOtp(email, token)
      if (result?.error) {
        setCodeError(result.error)
        setCode(Array(CODE_LENGTH).fill(''))
        requestAnimationFrame(() => codeRefs.current[0]?.focus())
      }
      // On success, verifyOtp does a server-side redirect — nothing more to do.
    })
  }, [email, code])

  // ── Resend ────────────────────────────────────────────────────────────────

  const handleResend = useCallback(() => {
    if (resendAt !== null && Date.now() < resendAt) return
    startSend(async () => {
      await sendOtp(email)
      setCode(Array(CODE_LENGTH).fill(''))
      setResendAt(Date.now() + RESEND_COOLDOWN)
    })
  }, [email, resendAt])

  // ── Code box handlers ─────────────────────────────────────────────────────

  const handleCodeChange = useCallback((i: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (!raw) {
      setCode(prev => { const n = [...prev]; n[i] = ''; return n })
      return
    }
    fillCode(raw, i)
  }, [fillCode])

  const handleCodeKeyDown = useCallback((i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (code[i]) {
        setCode(prev => { const n = [...prev]; n[i] = ''; return n })
      } else if (i > 0) {
        setCode(prev => { const n = [...prev]; n[i - 1] = ''; return n })
        requestAnimationFrame(() => codeRefs.current[i - 1]?.focus())
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft'  && i > 0) {
      codeRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      codeRefs.current[i + 1]?.focus()
    }
  }, [code])

  const handleCodePaste = useCallback((i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    fillCode(e.clipboardData.getData('text'), i)
  }, [fillCode])

  const handleCodeFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }, [])

  const codeComplete = code.every(c => c.length === 1)
  const emailStep    = step === 'email'
  const isBusy       = isPendingSend || isPendingVerify

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-page)',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1240,
          margin: '0 auto',
          padding: '64px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 48,
          alignItems: 'start',
        }}
        className="signin-outer"
      >
        <style>{`
          @media (min-width: 900px) {
            .signin-outer {
              grid-template-columns: 1fr 1fr !important;
              align-items: stretch !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              min-height: 100vh;
              gap: 40px !important;
            }
            .signin-illus-wrap {
              width: 100% !important;
              max-width: 600px !important;
              margin-left: auto;
              margin-right: calc(-6vw);
            }
          }
          @media (max-width: 899px) {
            .signin-illus-wrap {
              width: 72%;
              max-width: 320px;
              margin: 0 auto;
            }
          }
        `}</style>

        {/* ── Left column ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0,
          }}
        >
          {/* Lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <Lockup size="large" layout="stacked" />
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 46,
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              margin: '0 0 20px',
            }}
          >
            Onboarding that already
            <br />
            knows your{' '}
            <span style={{ color: 'var(--color-accent)' }}>role.</span>
          </h1>

          {/* Sub-paragraph */}
          <p
            style={{
              maxWidth: 460,
              fontSize: 16,
              lineHeight: 1.65,
              color: 'var(--color-ink-muted)',
              margin: '0 0 44px',
            }}
          >
            Connected to HR, IT, docs, projects and comms — every answer scoped to
            whoever&rsquo;s asking.
          </p>

          {/* Sign-in card */}
          {/*
            noValidate: browser constraint validation swallows submit before our
            handler runs, so we do our own check and show a styled inline error.
          */}
          <form
            noValidate
            onSubmit={emailStep ? handleSendCode : handleVerify}
            style={{
              maxWidth: 380,
              borderRadius: 20,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-card)',
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {/* ── Step wrapper (animated height) ── */}
            <div
              className="signin-stack"
              style={{ height: stackHeight !== undefined ? stackHeight : undefined }}
            >

              {/* Step 1: Email */}
              <div
                ref={emailStep ? activeStepRef : undefined}
                className="signin-step"
                data-state={emailStep ? 'active' : 'before'}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    paddingBottom: emailStep ? 0 : undefined,
                  }}
                >
                  <span className="section-label">Sign in</span>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 13,
                      color: 'var(--color-ink)',
                    }}
                  >
                    Work email
                    <input
                      ref={emailRef}
                      type="email"
                      className="field"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError('') }}
                      disabled={isBusy}
                    />
                  </label>

                  {emailError && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)', lineHeight: 1.4 }}>
                      {emailError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isBusy}
                    style={{ width: '100%', paddingTop: 12, paddingBottom: 12 }}
                  >
                    {isPendingSend ? 'Sending…' : 'Send code'}
                  </button>

                  <p style={{ margin: 0, fontSize: 11, color: 'var(--color-ink-muted)', lineHeight: 1.5, textAlign: 'center' }}>
                    If this address is registered, a code is on its way.
                  </p>
                </div>
              </div>

              {/* Step 2: Code */}
              <div
                ref={!emailStep ? activeStepRef : undefined}
                className="signin-step"
                data-state={!emailStep ? 'active' : 'after'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="section-label">Check your email</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 11 }}
                      onClick={() => {
                        setStep('email')
                        setCode(Array(CODE_LENGTH).fill(''))
                        setCodeError('')
                      }}
                    >
                      Change
                    </button>
                  </div>

                  {/* Email line */}
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                    We sent a 6-digit code to{' '}
                    <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{email}</span>
                  </p>

                  {/* Code boxes */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${CODE_LENGTH}, 1fr)`,
                      gap: 8,
                    }}
                    role="group"
                    aria-label="Verification code"
                  >
                    {code.map((char, i) => (
                      <input
                        key={i}
                        ref={el => { codeRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                        maxLength={CODE_LENGTH}
                        value={char}
                        className="code-box"
                        style={{ '--box-index': i } as React.CSSProperties & Record<string, unknown>}
                        onChange={e => handleCodeChange(i, e)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
                        onPaste={e => handleCodePaste(i, e)}
                        onFocus={handleCodeFocus}
                        disabled={isBusy}
                      />
                    ))}
                  </div>

                  {codeError && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-incorrect)', lineHeight: 1.4 }}>
                      {codeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!codeComplete || isBusy}
                    style={{ width: '100%', paddingTop: 12, paddingBottom: 12 }}
                  >
                    {isPendingVerify ? 'Verifying…' : 'Verify and continue'}
                  </button>

                  {/* Resend live region */}
                  <div
                    aria-live="polite"
                    style={{
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {resendLabel ? (
                      <span style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
                        {resendLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={isBusy}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 12,
                          color: 'var(--color-accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* ── Right column: illustration ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          <div className="signin-illus-wrap" style={{ position: 'relative' }}>
            {/* Decorative backdrop */}
            <svg
              viewBox="0 0 600 600"
              aria-hidden="true"
              focusable="false"
              style={{
                position:      'absolute',
                inset:         '-8%',
                width:         '116%',
                height:        '116%',
                pointerEvents: 'none',
                userSelect:    'none',
              }}
            >
              <path d="M-20,520 C80,400 220,280 400,60" fill="none" stroke="var(--color-border)" strokeWidth={1.5} strokeLinecap="round" />
              <path d="M580,80 C480,200 340,320 160,540" fill="none" stroke="var(--color-border)" strokeWidth={1.5} strokeLinecap="round" />
              <path d="M-20,300 C100,240 200,200 380,220 C460,228 540,260 620,300" fill="none" stroke="var(--color-border)" strokeWidth={1.5} strokeLinecap="round" />
              <Sparkle x={40}  y={70}  size={7}   color="var(--color-yellow)" />
              <Sparkle x={520} y={60}  size={5}   color="var(--color-accent-soft)" />
              <Sparkle x={30}  y={430} size={6}   color="var(--color-accent-soft)" />
              <Sparkle x={545} y={470} size={8}   color="var(--color-yellow)" />
              <Sparkle x={300} y={20}  size={4.5} color="var(--color-yellow)" />
              <Sparkle x={495} y={260} size={5.5} color="var(--color-accent-soft)" />
              <Sparkle x={70}  y={250} size={4.5} color="var(--color-yellow)" />
            </svg>

            {/* Hero illustration */}
            <svg
              viewBox="0 0 1024 1024"
              aria-hidden="true"
              focusable="false"
              style={{
                display: 'block', width: '100%', height: 'auto',
                userSelect: 'none', position: 'relative',
              }}
            >
              <g transform="translate(0,1024) scale(0.1,-0.1)">
                <path d={TRACED_ACCENT}    fill="var(--color-accent)"  />
                <path d={TRACED_SURFACE}   fill="var(--color-surface)" />
                <path d={TRACED_INK}       fill="var(--color-ink)"     />
                <path d={TRACED_HIGHLIGHT} fill="var(--color-yellow)"  />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Code box inline styles */}
      <style>{`
        .code-box {
          height: 56px;
          border-radius: 14px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          text-align: center;
          font-size: 18px;
          font-weight: 600;
          outline: none;
          color: var(--color-ink);
          width: 100%;
          font-family: var(--font-sans);
        }
        .code-box:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 4px var(--color-accent-soft);
        }
        .code-box:disabled {
          opacity: 0.5;
        }
      `}</style>
    </main>
  )
}
