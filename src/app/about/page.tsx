import { Navbar } from '@/components/Navbar'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar active="create" />
      <div className="max-w-[720px] mx-auto px-8 pt-32 pb-24">

        {/* Header */}
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          About
        </p>
        <h1 className="font-extrabold mb-6" style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.02em', color: 'var(--foreground)', lineHeight: 1.1 }}>
          Tools for producers.<br />Built by a producer.
        </h1>
        <p className="mb-16" style={{ fontSize: 16, color: 'var(--foreground-muted)', lineHeight: 1.8 }}>
          pulp started as a personal frustration. Every AI music tool either generated full audio (no control), or required a music degree to operate. There was nothing in between — a fast, intelligent tool that speaks the language of producers.
        </p>

        {/* The product */}
        <div className="mb-16">
          <h2 className="font-extrabold mb-4" style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, color: 'var(--foreground)' }}>
            What pulp does
          </h2>
          <p style={{ fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.8, marginBottom: 16 }}>
            You describe a track. pulp generates 4 independent MIDI tracks — melody, chords, bass, and drums — tuned to your genre, key, and tempo. In under a second. Royalty-free. Ready to drop into FL Studio, Ableton, or Logic.
          </p>
          <p style={{ fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.8 }}>
            It's not trying to replace you. It's trying to get you to the idea faster.
          </p>
        </div>

        {/* papaya ecosystem */}
        <div className="mb-16 rounded-2xl p-8" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#FF6D3F', letterSpacing: '0.08em', marginBottom: 12 }}>
            THE ECOSYSTEM
          </p>
          <h2 className="font-extrabold mb-4" style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, color: 'var(--foreground)' }}>
            papaya<span style={{ color: '#00B894' }}>●</span>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.8, marginBottom: 24 }}>
            pulp is the first tool in the papaya ecosystem — a suite of AI-powered production tools built around one idea: get from nothing to something, fast.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {[
              { name: 'pulp', desc: 'AI MIDI generator — 4 tracks, instant.', status: 'live', color: '#FF6D3F' },
              { name: 'seed', desc: 'AI Serum preset generator — sound design without the knob-turning.', status: 'coming soon', color: '#A78BFA' },
              { name: 'grove', desc: 'AI arrangement assistant — structure your track automatically.', status: 'planned', color: '#00B894' },
              { name: 'blend', desc: 'AI mix feedback — get actionable notes on your mix.', status: 'planned', color: '#E94560' },
              { name: 'press', desc: 'AI mastering — one-click masters ready for distribution.', status: 'planned', color: '#FFAB91' },
            ].map(tool => (
              <div key={tool.name} className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tool.color, flexShrink: 0 }} />
                  <span className="font-extrabold" style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, color: 'var(--foreground)' }}>
                    {tool.name}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{tool.desc}</span>
                </div>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: tool.status === 'live' ? '#00B894' : tool.status === 'coming soon' ? '#FF6D3F' : 'var(--muted)',
                  border: `1px solid ${tool.status === 'live' ? 'rgba(0,184,148,0.3)' : tool.status === 'coming soon' ? 'rgba(255,109,63,0.3)' : 'var(--border)'}`,
                  padding: '2px 8px',
                  borderRadius: 6,
                  flexShrink: 0,
                }}>
                  {tool.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Try pulp free →
          </Link>
        </div>
      </div>
    </div>
  )
}

