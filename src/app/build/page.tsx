import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { GENRES } from '@/lib/music-engine';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Build',
  description:
    'How to turn pulp MIDI into a finished track: layer roles, groove, arrangement, and sample search tips—built for electronic producers in any DAW.',
  path: '/build',
});

type LayerKey = 'melody' | 'chords' | 'bass' | 'drums';

const LAYER_LABELS: Record<LayerKey, string> = {
  melody: 'Melody',
  chords: 'Chords',
  bass: 'Bass',
  drums: 'Drums',
};

const LAYER_PURPOSE: Record<LayerKey, { color: string; body: string }> = {
  melody: {
    color: '#FF6D3F',
    body: 'Your hook and topline. Use it as the main synth/lead or layer it with a second instrument for width.',
  },
  chords: {
    color: 'rgba(255,255,255,0.50)',
    body: 'Harmony and mood. Great for pads, stabs, or piano. Use inversions to keep the movement smooth.',
  },
  bass: {
    color: 'rgba(255,255,255,0.40)',
    body: 'Low-end foundation. Keep it tight with the kick and simplify notes when the arrangement gets busy.',
  },
  drums: {
    color: 'rgba(255,255,255,0.28)',
    body: 'Groove and energy. Swap sounds, add ghost hits, and automate fills to create transitions.',
  },
};

// Mirrors the homepage’s genre→instrument suggestions (kept local to avoid coupling to the page component).
const SPLICE_INSTRUMENTS: Record<string, { melody: string; chords: string; bass: string; drums: string }> = {
  deep_house:        { melody: 'pluck',       chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  melodic_house:     { melody: 'melody',      chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  tech_house:        { melody: 'pluck',       chords: 'chord stab',   bass: 'bass loop',  drums: 'kick'         },
  minimal_tech:      { melody: 'lead',        chords: 'chord',        bass: 'bass',       drums: 'kick'         },
  techno:            { melody: 'lead',        chords: 'chord',        bass: 'bass',       drums: 'kick loop'    },
  melodic_techno:    { melody: 'lead',        chords: 'pad',          bass: 'bass',       drums: 'kick'         },
  hard_techno:       { melody: 'lead',        chords: 'stab',         bass: 'bass',       drums: 'kick'         },
  progressive_house: { melody: 'synth',       chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  afro_house:        { melody: 'melody',      chords: 'chord',        bass: 'bass loop',  drums: 'percussion'   },
  trance:            { melody: 'lead',        chords: 'supersaw pad', bass: 'bass',       drums: 'kick'         },
  house:             { melody: 'piano',       chords: 'chord stab',   bass: 'bass loop',  drums: 'kick'         },
  drum_and_bass:     { melody: 'melody',      chords: 'chord',        bass: 'reese bass', drums: 'break'        },
  hiphop:            { melody: 'melody',      chords: 'chord',        bass: '808',        drums: 'drum loop'    },
  rnb:               { melody: 'melody',      chords: 'chord pad',    bass: 'bass',       drums: 'drum loop'    },
  disco_nu_disco:    { melody: 'melody',      chords: 'chord',        bass: 'bass loop',  drums: 'disco drum'   },
};

function getSpliceTerms(genreKey: string, bpm: number): Record<LayerKey, string> {
  const genreName = GENRES[genreKey]?.name ?? genreKey;
  const inst = SPLICE_INSTRUMENTS[genreKey] ?? { melody: 'melody', chords: 'chord', bass: 'bass', drums: 'drums' };
  return {
    melody: `${genreName} ${inst.melody} ${bpm}`,
    chords: `${genreName} ${inst.chords}`,
    bass: `${genreName} ${inst.bass} ${bpm}`,
    drums: `${genreName} ${inst.drums}`,
  };
}

const POPULAR_GENRES: Array<{ key: string; bpm: number }> = [
  { key: 'techno', bpm: 132 },
  { key: 'melodic_techno', bpm: 124 },
  { key: 'tech_house', bpm: 128 },
  { key: 'deep_house', bpm: 122 },
  { key: 'house', bpm: 124 },
  { key: 'trance', bpm: 138 },
  { key: 'drum_and_bass', bpm: 174 },
  { key: 'hiphop', bpm: 92 },
];

function spliceSearchUrl(query: string) {
  return `https://splice.com/sounds/search?q=${encodeURIComponent(query)}`;
}

function TimelineStep({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(255,109,63,0.12)',
            border: '1px solid rgba(255,109,63,0.35)',
            color: '#FF6D3F',
          }}
        >
          {num}
        </div>
        <div className="flex-1 w-px" style={{ background: 'rgba(255,255,255,0.06)', marginTop: 16 }} />
      </div>

      <div className="flex-1 pb-10">
        <h2
          className="font-extrabold mb-3"
          style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.2 }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export default function BuildMyTrackPage() {
  const exampleGenre = 'melodic_techno';
  const exampleBpm = 124;
  const exampleTerms = getSpliceTerms(exampleGenre, exampleBpm);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="build" />

      {/* Header */}
      <section className="pt-36 pb-12 px-8">
        <div className="max-w-[960px] mx-auto">
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}
          >
            GUIDE
          </p>
          <h1
            className="font-extrabold text-gradient mb-4"
            style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 'clamp(32px, 5vw, 44px)', letterSpacing: '-0.02em', lineHeight: 1.12 }}
          >
            Build My Track
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, maxWidth: 720, lineHeight: 1.7 }}>
            A step-by-step workflow to turn a generated MIDI idea into a finished arrangement using your DAW and samples.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="pb-24 px-8">
        <div className="max-w-[960px] mx-auto">
          <div className="rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <TimelineStep num="1" title="Generate">
              <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
                Start by generating a track idea. Pick a genre + tempo, then audition variations until one feels right.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold transition-all"
                style={{
                  textDecoration: 'none',
                  background: 'rgba(255,109,63,0.12)',
                  border: '1px solid rgba(255,109,63,0.35)',
                  color: '#FF6D3F',
                }}
              >
                Go to generator →
              </Link>
            </TimelineStep>

            <TimelineStep num="2" title="Your MIDI layers">
              <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Pulp gives you four layers. Treat them like a blueprint: keep the notes, swap the instruments, and build a mix around them.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['melody', 'chords', 'bass', 'drums'] as const).map(layer => (
                  <div
                    key={layer}
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className="font-bold mb-2"
                          style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}
                        >
                          <span style={{ color: LAYER_PURPOSE[layer].color }}>{LAYER_LABELS[layer]}</span>
                        </p>
                        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
                          {LAYER_PURPOSE[layer].body}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p
                        className="text-xs uppercase tracking-widest mb-2"
                        style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.45)' }}
                      >
                        Splice suggestion (example)
                      </p>
                      <a
                        href={spliceSearchUrl(exampleTerms[layer])}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
                      >
                        {exampleTerms[layer]} ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </TimelineStep>

            <TimelineStep num="3" title="Arrange in your DAW">
              <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Import the MIDI, assign instruments, and build sections (intro → groove → break → drop → outro). Keep transitions simple and repeatable.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'FL Studio',
                    tips: [
                      'Drag MIDI into the Playlist to create patterns.',
                      'Use the Piano Roll to quantize (Alt+Q) and strum (Alt+S).',
                      'Route each layer to its own Mixer track early.',
                    ],
                  },
                  {
                    title: 'Ableton Live',
                    tips: [
                      'Drop MIDI on an Instrument track, then duplicate clips for sections.',
                      'Use Groove Pool lightly for drums; keep bass tight.',
                      'Automate filter + reverb sends for builds and breaks.',
                    ],
                  },
                  {
                    title: 'Logic Pro',
                    tips: [
                      'Drag MIDI to a Software Instrument track, then use Track Stacks.',
                      'Humanize sparingly; keep kick/bass locked.',
                      'Use region-based automation for quick arrangement changes.',
                    ],
                  },
                ].map(card => (
                  <div
                    key={card.title}
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <p className="font-bold mb-3" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
                      {card.title}
                    </p>
                    <ul className="space-y-2">
                      {card.tips.map(t => (
                        <li key={t} style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                          <span style={{ color: 'rgba(255,109,63,0.9)', marginRight: 8 }}>✦</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </TimelineStep>

            <TimelineStep num="4" title="Add samples">
              <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Replace placeholder sounds with high-quality samples. Below are three Splice search ideas per layer based on popular genres.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(['melody', 'chords', 'bass', 'drums'] as const).map(layer => (
                  <div
                    key={layer}
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-bold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
                        {LAYER_LABELS[layer]}
                      </p>
                      <span
                        className="text-xs px-2 py-1 rounded-md"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          background: `${LAYER_PURPOSE[layer].color}12`,
                          border: `1px solid ${LAYER_PURPOSE[layer].color}33`,
                          color: LAYER_PURPOSE[layer].color,
                        }}
                      >
                        3 searches
                      </span>
                    </div>

                    <div className="space-y-2">
                      {POPULAR_GENRES.slice(0, 3).map(g => {
                        const term = getSpliceTerms(g.key, g.bpm)[layer];
                        return (
                          <a
                            key={`${layer}-${g.key}`}
                            href={spliceSearchUrl(term)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              textDecoration: 'none',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 12,
                              color: 'var(--muted)',
                            }}
                          >
                            <span style={{ color: 'rgba(240,240,255,0.85)' }}>
                              {GENRES[g.key]?.name ?? g.key}
                            </span>
                            <span style={{ color: 'rgba(138,138,154,0.55)' }}> — </span>
                            {term} ↗
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p style={{ color: 'rgba(240,240,255,0.85)', fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8 }}>
                  Pro tip
                </p>
                <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: 14 }}>
                  Keep the MIDI, change the sound. The fastest way to level up is replacing instruments with genre-correct samples and presets.
                </p>
              </div>
            </TimelineStep>

            {/* Remove final vertical line */}
            <div style={{ height: 0 }} />
          </div>
        </div>
      </section>
    </div>
  );
}

