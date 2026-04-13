import Link from 'next/link';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Commercial license',
  description:
    'Commercial and personal-use terms for MIDI exported from pulp—Free vs Pro rights, ownership of your files, and third-party responsibilities.',
  path: '/legal/license',
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
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
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          ← Back to pulp
        </Link>

        <h1 className="mt-6" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Commercial License
        </h1>
        <p className="mt-3" style={{ color: 'var(--muted)' }}>
          How you can use generated MIDI, by plan.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4">
          <Card title="Free plan">
            <ul style={{ paddingLeft: 18 }}>
              <li className="mt-2">Personal use only.</li>
              <li className="mt-2">Non-commercial projects only.</li>
              <li className="mt-2">Attribution is optional.</li>
            </ul>
          </Card>

          <Card title="Pro plan">
            <ul style={{ paddingLeft: 18 }}>
              <li className="mt-2">Commercial use allowed.</li>
              <li className="mt-2">No attribution required.</li>
            </ul>
          </Card>

          <Card title="Ownership">
            <p>
              pulp does not claim copyright in the MIDI you generate. You own your exported files, subject to the plan terms above.
            </p>
          </Card>

          <Card title="Third-party rights">
            <p>
              You are responsible for how you use the MIDI and for complying with applicable laws and third-party terms.
            </p>
          </Card>
        </div>

        <div className="mt-12 pt-6" style={{ borderTop: '1px solid var(--border)', color: 'color-mix(in srgb, var(--muted) 75%, transparent)' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            Last updated: 2026-04-08
          </p>
        </div>
      </div>
    </div>
  );
}

