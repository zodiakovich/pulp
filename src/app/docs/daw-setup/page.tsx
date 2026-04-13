import { pageMeta } from '@/lib/seo-metadata';
import { DocH2, DocH3, DocLead, DocP, DocUl } from '@/components/docs/DocTypography';

export const metadata = pageMeta({
  title: 'DAW Setup',
  description:
    'Import pulp MIDI into FL Studio, Ableton Live, Logic Pro, Cubase, and Studio One—plus how to drop WAV files on the timeline.',
  path: '/docs/daw-setup',
});

type Daw = { name: string; steps: string[] };

const DAWS: Daw[] = [
  {
    name: 'FL Studio',
    steps: [
      'Open a project or create a new empty project.',
      'Go to File → Import → MIDI File… and choose your .mid file, or drag the .mid from Explorer/Finder directly onto the Playlist.',
      'FL imports MIDI to new instrument tracks; pick a Channel Rack instrument per track or route to plugins you prefer.',
      'Set the project BPM to match your file if prompted, or type the tempo in the transport.',
    ],
  },
  {
    name: 'Ableton Live',
    steps: [
      'Open Session or Arrangement view.',
      'Drag the .mid file from the browser or your desktop into a MIDI track in the Arrangement timeline (or onto a Session slot).',
      'Live creates or populates MIDI clips on that track; add an instrument (e.g. Wavetable, Operator) if the track is empty.',
      'Confirm the clip and project BPM align with your export.',
    ],
  },
  {
    name: 'Logic Pro',
    steps: [
      'Open an empty project or existing song.',
      'Use File → Import → MIDI File… and select your .mid, or drag the .mid into the Tracks area.',
      'Logic creates software instrument tracks per MIDI region; choose instruments from the Library as needed.',
      'If tempo import behaves unexpectedly, review File → Project Settings → Smart Tempo for your workflow.',
    ],
  },
  {
    name: 'Cubase',
    steps: [
      'Open the Project window.',
      'Choose File → Import → MIDI File…, select your .mid, and confirm the import dialog (tracks, destination).',
      'Alternatively, drag the .mid from the Media Bay or OS file browser into the project; Cubase creates tracks with MIDI parts.',
      'Load instruments on each track and verify tempo and time signature in the transport bar.',
    ],
  },
  {
    name: 'Studio One',
    steps: [
      'Open the Song page.',
      'Use File → Import → MIDI… and pick your .mid, or drag the file onto the Arranger timeline.',
      'Studio One creates instrument tracks for incoming MIDI; assign Presence XT or your preferred instrument per track.',
      'Match song tempo to your file if the import dialog offers to align tempo.',
    ],
  },
];

export default function DawSetupPage() {
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
        Docs · DAW Setup
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
        DAW setup guides
      </h1>
      <DocLead>
        pulp exports standard MIDI files and stereo WAV renders. MIDI goes through each DAW’s import flow; WAV can be dropped straight onto the timeline in
        almost any host.
      </DocLead>

      <DocH2>WAV files</DocH2>
      <DocP>
        <strong style={{ color: 'var(--text)' }}>WAV files can be dragged directly into any DAW timeline</strong> as an audio clip—no import wizard required.
        Align start position and grid if your DAW does not snap automatically.
      </DocP>

      {DAWS.map((d) => (
        <section key={d.name}>
          <DocH3>{d.name}</DocH3>
          <DocUl>
            {d.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </DocUl>
        </section>
      ))}
    </>
  );
}
