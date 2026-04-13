import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'About',
  description:
    'pulp is an AI MIDI generator built by papaya—part of a suite of AI music production tools including seed, grove, blend, and press.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="create" />
      <div className="mx-auto max-w-[720px] px-6 pb-24 pt-24 sm:px-8 sm:pt-28">
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          ← Back to pulp
        </Link>

        <p
          className="mt-10"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          About
        </p>

        <h1
          className="mt-3"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: 'var(--text)',
          }}
        >
          pulp by papaya
        </h1>

        <div
          className="mt-10 space-y-8"
          style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, lineHeight: 1.8, color: 'var(--muted)' }}
        >
          <p>
            <strong style={{ color: 'var(--text)' }}>pulp</strong> is an AI MIDI generator built by{' '}
            <strong style={{ color: 'var(--text)' }}>papaya</strong>—a suite of AI-powered music production tools. You describe a track in plain language;
            pulp returns editable MIDI—melody, chords, bass, and drums—that you shape further in your DAW.
          </p>

          <p>
            papaya exists to shorten the gap between idea and arrangement: we care about producer control, transparent limits, and files you can actually open
            in the tools you already use.
          </p>

          <p>
            Alongside pulp, we are building an ecosystem of complementary products—some live, some on the roadmap—including{' '}
            <strong style={{ color: 'var(--text)' }}>seed</strong> (coming soon), <strong style={{ color: 'var(--text)' }}>grove</strong>,{' '}
            <strong style={{ color: 'var(--text)' }}>blend</strong>, and <strong style={{ color: 'var(--text)' }}>press</strong> (planned). Each is meant to
            tackle a different slice of the workflow while sharing the same respect for your time and your stems.
          </p>

          <p>
            Ready to try it?{' '}
            <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              Start generating
            </Link>
            {' · '}
            <Link href="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              View pricing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
