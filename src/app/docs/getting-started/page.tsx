import { pageMeta } from '@/lib/seo-metadata';
import { DocH2, DocLead, DocOl, DocP } from '@/components/docs/DocTypography';

export const metadata = pageMeta({
  title: 'Getting Started',
  description:
    'Start with pulp in five steps: account, prompt with genre and BPM, piano roll edits, built-in mix preview, then export MIDI or WAV.',
  path: '/docs/getting-started',
});

export default function GettingStartedPage() {
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
        Docs · Getting Started
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
        Getting Started
      </h1>
      <DocLead>Five steps from an empty prompt to files you can open in any DAW.</DocLead>

      <DocH2>Step 1: Sign up or start free</DocH2>
      <DocP>
        Open the home page and sign in with Clerk when you want history, credits, and sync across devices. You can explore the interface first; some limits
        apply without an account depending on your plan.
      </DocP>

      <DocH2>Step 2: Describe what you want</DocH2>
      <DocP>
        Write a short prompt: genre, mood, reference artists, and rough BPM help. Pick key and scale if you want a specific tonal center—the generator uses
        these controls together with your text.
      </DocP>

      <DocH2>Step 3: Edit in the piano roll</DocH2>
      <DocP>
        Switch to the piano roll for any layer to move notes, resize lengths, and adjust velocity. Use the chord overlay when you want harmony context from
        another layer. See the Piano Roll guide for shortcuts.
      </DocP>

      <DocH2>Step 4: Mix with the built-in engine</DocH2>
      <DocP>
        Playback runs through pulp’s mix bus: per-layer gain staging, EQ, stereo width on melody, and shared reverb on harmonic layers. It is tuned for quick
        previews—use your DAW for final polish.
      </DocP>

      <DocH2>Step 5: Export MIDI or WAV</DocH2>
      <DocP>
        Download multi-track MIDI or render a stereo WAV from the current mix when the app offers export. Drag the files straight into your session; see DAW
        Setup for import menu paths.
      </DocP>

      <DocH2>Next</DocH2>
      <DocOl>
        <li>
          <a href="/docs/daw-setup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            DAW Setup
          </a>{' '}
          — import paths per workstation
        </li>
        <li>
          <a href="/docs/piano-roll" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Piano Roll
          </a>{' '}
          — editing and shortcuts
        </li>
      </DocOl>
    </>
  );
}
