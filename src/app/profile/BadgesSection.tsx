'use client';

import { useState } from 'react';
import { BADGE_DEFS, type EarnedBadge } from '@/lib/badges';

export function BadgesSection({ earned }: { earned: EarnedBadge[] }) {
  const [tab, setTab] = useState<'all' | 'earned'>('all');
  const earnedMap = new Map(earned.map(b => [b.id, b]));
  const earnedBadges = BADGE_DEFS.filter(b => earnedMap.has(b.id));
  const displayed = tab === 'earned' ? earnedBadges : BADGE_DEFS;

  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}>
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Badges
        </p>
        <div className="flex gap-1">
          {(['all', 'earned'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                height: 28,
                padding: '0 12px',
                borderRadius: 8,
                border: `1px solid ${tab === t ? 'rgba(255,109,63,0.45)' : 'var(--border)'}`,
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                background: tab === t ? 'rgba(255,109,63,0.10)' : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 150ms, color 150ms, background 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {t === 'all'
                ? 'All badges'
                : `Earned${earned.length > 0 ? ` (${earned.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'earned' && earnedBadges.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <p
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontSize: 14,
              color: 'var(--muted)',
            }}
          >
            No badges earned yet — keep creating!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {displayed.map(badge => {
            const e = earnedMap.get(badge.id);
            const isEarned = !!e;
            const earnedDate = e
              ? new Date(e.earned_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <div
                key={badge.id}
                className="rounded-2xl p-4 flex flex-col items-center text-center gap-2"
                style={{
                  border: `1px solid ${isEarned ? 'rgba(255,109,63,0.30)' : 'var(--border)'}`,
                  background: isEarned ? 'rgba(255,109,63,0.06)' : 'var(--surface)',
                  filter: isEarned ? 'none' : 'grayscale(1)',
                  opacity: isEarned ? 1 : 0.5,
                  transition: 'opacity 200ms',
                }}
                title={isEarned ? `Earned ${earnedDate ?? ''}` : 'Locked'}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>
                  {isEarned ? badge.icon : '🔒'}
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: '-0.01em',
                      color: isEarned ? 'var(--foreground)' : 'var(--muted)',
                      lineHeight: 1.3,
                    }}
                  >
                    {badge.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9,
                      color: 'var(--muted)',
                      marginTop: 3,
                      lineHeight: 1.5,
                    }}
                  >
                    {badge.description}
                  </p>
                  {earnedDate && (
                    <p
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9,
                        color: 'var(--accent)',
                        marginTop: 4,
                      }}
                    >
                      {earnedDate}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
