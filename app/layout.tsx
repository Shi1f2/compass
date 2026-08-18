import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Compass — find your bearings',
  description:
    'An embedded onboarding assistant that already knows your systems, your role and your first week — mentor, tutor and compliance record in one.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Google Fonts hosts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Poppins at 400 / 500 / 600 / 700 — swap display so the fallback
            stack is used immediately when there is no network access */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
        />
        {/* Reduced-motion data attribute stamped before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.setAttribute('data-reduced-motion', '');
  }
} catch (e) {}
`.trim(),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
