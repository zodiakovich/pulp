import { Navbar } from '@/components/Navbar'
import { SiteFooter } from '@/components/SiteFooter'
import { CHANGELOG } from '@/lib/changelog'
import { pageMeta } from '@/lib/seo-metadata'

export const metadata = pageMeta({
  title: 'Changelog',
  description:
    'Release notes for pulp — new features, improvements, and fixes listed newest first.',
  path: '/changelog',
})

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="changelog" />
      <div className="max-w-[720px] mx-auto px-8 pt-32 pb-24">
        <h1
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          Changelog
        </h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)', marginBottom: 56 }}>
          Every update to pulp, in reverse chronological order.
        </p>

        <div style={{ position: 'relative' }}>
          {/* Vertical timeline line */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 11,
              top: 12,
              bottom: 0,
              width: 1,
              background: 'linear-gradient(to bottom, rgba(255,109,63,0.4) 0%, color-mix(in srgb, var(--text) 8%, transparent) 40%, transparent 100%)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
            {CHANGELOG.map((entry, i) => {
              const isLatest = i === 0
              return (
                <div key={entry.version} style={{ display: 'flex', gap: 28 }}>
                  {/* Node */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: isLatest ? 'rgba(255,109,63,0.18)' : 'color-mix(in srgb, var(--text) 6%, transparent)',
                        border: isLatest ? '2px solid rgba(255,109,63,0.7)' : '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isLatest ? 'var(--accent)' : 'var(--muted)',
                          opacity: isLatest ? 1 : 0.4,
                        }}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 12,
                          padding: '3px 10px',
                          borderRadius: 20,
                          border: isLatest ? '1px solid rgba(255,109,63,0.45)' : '1px solid var(--border)',
                          background: isLatest ? 'rgba(255,109,63,0.12)' : 'color-mix(in srgb, var(--text) 4%, transparent)',
                          color: isLatest ? 'var(--accent)' : 'var(--muted)',
                        }}
                      >
                        v{entry.version}
                      </span>
                      {isLatest && (
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(0,184,148,0.35)',
                            background: 'rgba(0,184,148,0.1)',
                            color: '#00B894',
                          }}
                        >
                          latest
                        </span>
                      )}
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                        {formatDate(entry.date)}
                      </span>
                    </div>

                    <h2
                      style={{
                        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                        fontWeight: 700,
                        fontSize: 22,
                        color: 'var(--text)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        marginBottom: 16,
                      }}
                    >
                      {entry.title}
                    </h2>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {entry.changes.map((change, j) => (
                        <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3, fontSize: 10 }}>✦</span>
                          <span
                            style={{
                              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                              fontSize: 14,
                              color: 'var(--muted)',
                              lineHeight: 1.6,
                            }}
                          >
                            {change}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
