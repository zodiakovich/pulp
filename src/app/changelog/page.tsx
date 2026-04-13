import { Navbar } from '@/components/Navbar'
import { pageMeta } from '@/lib/seo-metadata'

export const metadata = pageMeta({
  title: 'Changelog',
  description:
    'Release notes for pulp: new MIDI features, billing, auth, performance, and export updates—listed newest first.',
  path: '/changelog',
})

export default function ChangelogPage() {
  const entries = [
    {
      version: '1.0',
      date: 'Apr 9, 2026',
      title: 'The Big One',
      changes: [
        'Stripe payments — Pro plan live at $7/month',
        'Clerk authentication — sign in with Google',
        'Supabase history — last 10 generations saved to your account',
        'Rate limiting — fair use for everyone via Upstash',
        'Security headers — XSS, clickjacking protection',
        'Input validation — server-side with Zod',
        'Drag to DAW — drag .mid files directly into FL Studio or Ableton',
        'Vibe selector — Dark, Euphoric, Groovy, Aggressive, Dreamy, Funky, Minimal, Festival',
        'Hero demo preview — animated MIDI preview before you generate',
        'Generation counter — real-time count of patterns created',
        'Staged loading — multi-step generation animation',
        'Dark mode by default',
        'Blog — production tips for electronic producers',
        'PWA — installable as desktop app',
        'Playwright E2E tests',
      ],
    },
    {
      version: '0.9',
      date: 'Apr 7, 2026',
      title: 'Polish & Security',
      changes: [
        'Light mode color fixes — full theme-aware UI',
        'Navbar consistency across all pages',
        'Explore page empty state with skeleton loading',
        'Blog placeholder with realistic articles',
        'Supabase RLS — row level security on all tables',
      ],
    },
    {
      version: '0.8',
      date: 'Apr 4, 2026',
      title: 'Generator Core',
      changes: [
        '3 simultaneous variations',
        '20 genres, 15 style tags',
        'BPM slider, tap tempo, and audio BPM detection',
        'Key and scale selection',
        'Feel/humanization slider',
        '4 layer cards with individual toggles',
        'Piano roll editor — click to add/remove notes',
        'Sheet music viewer',
        'Chord progression display',
        'Regenerate individual layers',
        'Extend by 8 bars',
        'Complete Pattern from seed notes',
        'Audio to MIDI converter',
        'Export to Ableton .als',
        'MusicXML and JSON export',
        'Splice search terms per layer',
        'Inspire from artist/song via Claude AI',
        'Share URL per generation',
        'Collab mode — real-time session link',
        'Live jamming mode',
        'Compare variations mode',
        'Keyboard shortcuts',
        'Command bar (Cmd+K)',
        'Onboarding tooltips',
      ],
    },
    {
      version: '0.1',
      date: 'Mar 28, 2026',
      title: 'First Generation',
      changes: [
        'Basic MIDI generation — melody, chords, bass, drums',
        'Genre selection',
        'Download .mid file',
        'Web Audio API playback',
      ],
    },
  ]

  return (
    <div className="min-h-screen">
      <Navbar active="create" />
      <div className="max-w-[720px] mx-auto px-8 pt-32 pb-24">
        <h1 className="font-extrabold mb-3" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-0.02em', color: 'var(--foreground)', lineHeight: 1.15 }}>
          Changelog
        </h1>
        <p className="mb-16" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
          Every update to pulp, in reverse chronological order.
        </p>

        <div className="space-y-16">
          {entries.map((entry, i) => (
            <div key={entry.version} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', paddingTop: i === 0 ? 0 : 48 }}>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      color: 'var(--accent)',
                      border: '1px solid rgba(255,109,63,0.35)',
                      background: 'rgba(255,109,63,0.10)',
                      padding: '3px 8px',
                      borderRadius: 8,
                    }}>
                      v{entry.version}
                    </span>
                    {i === 0 && (
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: '#00B894',
                        border: '1px solid rgba(0,184,148,0.35)',
                        background: 'rgba(0,184,148,0.10)',
                        padding: '3px 8px',
                        borderRadius: 6,
                      }}>
                        latest
                      </span>
                    )}
                  </div>
                  <h2 className="font-extrabold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {entry.title}
                  </h2>
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', flexShrink: 0, marginTop: 4 }}>
                  {entry.date}
                </span>
              </div>
              <ul className="space-y-2">
                {entry.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }}>✦</span>
                    <span style={{ fontSize: 14, color: 'var(--foreground-muted)', lineHeight: 1.6 }}>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
