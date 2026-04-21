import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Pulp — AI MIDI Generator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* Grid overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          display: 'flex',
        }} />

        {/* Orange glow */}
        <div style={{
          position: 'absolute',
          right: -100,
          top: '50%',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(255,109,63,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 48,
        }}>
          <span style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-1px',
          }}>
            pulp
          </span>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#FF6D3F' }}>.</span>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 72,
          fontWeight: 800,
          color: 'white',
          lineHeight: 1.0,
          letterSpacing: '-3px',
          marginBottom: 24,
          maxWidth: 700,
        }}>
          Describe a sound. Get a beat.
        </div>

        {/* Subline */}
        <div style={{
          fontSize: 24,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 48,
          maxWidth: 600,
        }}>
          AI MIDI generator for music producers. Melody, chords, bass, and drums from text.
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 32,
          alignItems: 'center',
        }}>
          {[
            { value: '20+', label: 'Genres' },
            { value: 'Free', label: 'to start' },
            { value: 'No install', label: 'runs in browser' },
          ].map((stat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              {i > 0 && (
                <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)', display: 'flex' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{stat.value}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom right URL */}
        <div style={{
          position: 'absolute',
          bottom: 48,
          right: 80,
          fontSize: 16,
          color: 'rgba(255,255,255,0.25)',
        }}>
          pulp.bypapaya.com
        </div>
      </div>
    ),
    { ...size },
  );
}
