import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';
import { DocH2, DocLead, DocP } from '@/components/docs/DocTypography';

export const metadata = pageMeta({
  title: 'Documentation',
  description:
    'Learn how to use pulp: sign up, prompt for MIDI, edit in the piano roll, mix in the browser, and export to your DAW—with setup guides for major workstations.',
  path: '/docs',
});

const cards: { href: string; title: string; body: string }[] = [
  {
    href: '/docs/getting-started',
    title: 'Getting Started',
    body: 'From first sign-in to export—five short steps to your first pattern.',
  },
  {
    href: '/docs/daw-setup',
    title: 'DAW Setup',
    body: 'Import MIDI (and WAV) into FL Studio, Ableton Live, Logic Pro, Cubase, and Studio One.',
  },
  {
    href: '/docs/piano-roll',
    title: 'Piano Roll',
    body: 'Edit notes and velocity, chord overlay, undo/redo, and keyboard shortcuts.',
  },
  {
    href: '/docs/mix-engine',
    title: 'Mix Engine',
    body: 'How the built-in mix bus shapes playback before you render audio.',
  },
];

export default function DocsOverviewPage() {
  return (
    <>
      <p
        className="mb-2"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
        }}
      >
        pulp
      </p>
      <h1
        className="mb-6"
        style={{
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--text)',
        }}
      >
        Documentation
      </h1>
      <DocLead>
        Practical guides for the generator: prompts, editing, mixing in the app, and moving files into your DAW. Use the menu to jump between topics.
      </DocLead>

      <DocH2>Guides</DocH2>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-2xl p-6 transition-opacity duration-200 hover:opacity-95"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: '-0.02em',
                color: 'var(--text)',
                marginBottom: 8,
              }}
            >
              {c.title}
            </div>
            <p
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontSize: 15,
                lineHeight: 1.65,
                color: 'var(--muted)',
                margin: 0,
              }}
            >
              {c.body}
            </p>
          </Link>
        ))}
      </div>

      <DocP>
        Something missing?{' '}
        <Link href="/faq" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          FAQ
        </Link>{' '}
        ·{' '}
        <Link href="/contact" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Contact
        </Link>
      </DocP>
    </>
  );
}
