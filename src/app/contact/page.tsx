'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { CrispSupportLink } from '@/components/CrispSupportLink';

export default function ContactPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="mx-auto px-8 pt-32 pb-24" style={{ maxWidth: 560 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Contact
        </p>
        <h1 style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 16 }}>
          Get in touch
        </h1>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 40 }}>
          Have a question, bug report, or feedback? Use the options below — we read everything.
        </p>

        <div className="space-y-4">
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
              Live chat
            </p>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14 }}>
              The fastest way to reach us. Open the chat in the bottom corner of any page.
            </p>
            <CrispSupportLink
              label="Open support chat →"
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
              FAQ
            </p>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14 }}>
              Common questions about exports, plans, billing, and DAW compatibility.
            </p>
            <Link href="/faq" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>
              Browse the FAQ →
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
