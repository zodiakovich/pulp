import { pageMeta } from '@/lib/seo-metadata';
import { DocH2, DocLead, DocP, DocUl } from '@/components/docs/DocTypography';

export const metadata = pageMeta({
  title: 'Mix Engine',
  description:
    'How pulp’s in-browser mix bus works: gain staging per layer, EQ shaping, shared reverb, and tips before you export WAV.',
  path: '/docs/mix-engine',
});

export default function MixEngineDocPage() {
  return (
    <>
      <p
        className="mb-2"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
        }}
      >
        Docs · Mix Engine
      </p>
      <h1
        className="mb-6"
        style={{
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--text)',
        }}
      >
        Mix engine guide
      </h1>
      <DocLead>
        Playback in pulp runs through a dedicated mix graph on top of the Web Audio layer: each stem is gain-staged and shaped, then summed with a shared
        ambience bus on harmonic layers. It is designed for clear previews, not a mastering chain.
      </DocLead>

      <DocH2>Gain staging</DocH2>
      <DocP>
        Melody, chords, bass, and drums each enter through a controlled input level so simultaneous layers do not clip prematurely. Stages are tuned so a
        typical four-layer pattern sits in a healthy range before the master bus—use velocity in the piano roll if one layer still feels too hot or too quiet.
      </DocP>

      <DocH2>EQ</DocH2>
      <DocP>
        Melody receives high-pass and peaking filters to reduce mud and add presence. Chords get a gentler high-pass so pads stay wide without masking the
        top line. Bass includes low shelving so subs stay defined under the kick. Drums are shaped to keep transients audible without harshness. These are
        fixed musical curves rather than a full parametric mixer.
      </DocP>

      <DocH2>Reverb</DocH2>
      <DocP>
        Melody and chords share a stereo reverb send: part of each harmonic stem is routed to a common wet bus, then blended back at a modest level so parts
        glue without washing out rhythm. Bass and drums stay largely dry so low-end punch remains intact.
      </DocP>

      <DocH2>Stereo width (melody)</DocH2>
      <DocP>
        The melody path includes subtle stereo widening (short delay / pan offsets) after EQ so leads feel wider in headphones while staying mono-compatible
        at low frequencies.
      </DocP>

      <DocH2>Tips before export</DocH2>
      <DocUl>
        <li>Balance layers in the piano roll first—velocity edits translate directly to how aggressive each stem hits the bus.</li>
        <li>Compare solo vs full mix playback; if chords mask melody, thin chord voicings or lower chord velocity slightly.</li>
        <li>Export WAV when you are happy with the in-app balance; treat the file as a rough mix print for reference or re-import, then refine in your DAW.</li>
        <li>Remember the built-in chain is not a substitute for mastering—leave headroom in your DAW for EQ, compression, and limiting on the final master.</li>
      </DocUl>
    </>
  );
}
