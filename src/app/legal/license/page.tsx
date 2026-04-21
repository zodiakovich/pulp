import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'License & Commercial Use',
  description:
    'How you can use MIDI generated with pulp — personal and commercial license terms by plan, ownership rights, and what pulp does not claim.',
  path: '/legal/license',
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        style={{
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          color: 'var(--text)',
        }}
      >
        {title}
      </div>
      <div className="mt-3" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

export default function LicensePage() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
        >
          ← Back to pulp
        </Link>

        <h1
          className="mt-6"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          License &amp; Commercial Use
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6 }}>
          Everything you generate with pulp is yours. Here&rsquo;s what that means by plan.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4">
          <Card title="You own your MIDI">
            <p>
              All MIDI generated with pulp belongs to you — not us. Free and Pro users receive a
              personal-use license. Studio users receive a full commercial license. In every case,
              pulp makes no claim over anything you create.
            </p>
          </Card>

          <Card title="Personal License (Free &amp; Pro)">
            <p>You can:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li className="mt-1">Use generated MIDI in personal projects and demos.</li>
              <li className="mt-1">Include it in non-commercial music releases.</li>
              <li className="mt-1">Share recordings made from the MIDI freely.</li>
            </ul>
            <p style={{ marginTop: 12 }}>You cannot:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li className="mt-1">Resell or license the raw MIDI files to third parties.</li>
              <li className="mt-1">Use them in sync licensing deals (TV, film, ads).</li>
              <li className="mt-1">Submit them to royalty-collection societies as original compositions.</li>
            </ul>
          </Card>

          <Card title="Commercial License (Studio)">
            <p>Full commercial use, no restrictions. Studio subscribers can:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li className="mt-1">Release music commercially on any platform.</li>
              <li className="mt-1">Use MIDI in sync deals — TV, film, ads, and games.</li>
              <li className="mt-1">Sell beats or compositions that include pulp-generated MIDI.</li>
              <li className="mt-1">Use without attribution. No credit to pulp required.</li>
            </ul>
          </Card>

          <Card title="What pulp doesn't claim">
            <p>
              We do not claim copyright or ownership over any MIDI you export. We do not collect
              royalties on your music. We do not require attribution in releases, credits, or
              metadata. Your music is your music — full stop.
            </p>
          </Card>

          <Card title="Questions?">
            <p>
              If you have a use case that doesn&rsquo;t fit neatly into one of these categories,{' '}
              <Link
                href="/contact"
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
              >
                get in touch
              </Link>{' '}
              and we&rsquo;ll figure it out together.
            </p>
          </Card>
        </div>

        <div
          className="mt-12 pt-6"
          style={{
            borderTop: '1px solid var(--border)',
            color: 'color-mix(in srgb, var(--muted) 75%, transparent)',
          }}
        >
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            Last updated: 2026-04-21
          </p>
        </div>
      </div>
    </div>
  );
}
