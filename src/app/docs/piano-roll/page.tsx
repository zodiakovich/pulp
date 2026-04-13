import { pageMeta } from '@/lib/seo-metadata';
import { DocCode, DocH2, DocLead, DocP } from '@/components/docs/DocTypography';

export const metadata = pageMeta({
  title: 'Piano Roll',
  description:
    'Edit MIDI in pulp’s piano roll: notes, velocity, chord overlay, undo/redo, fullscreen, and keyboard shortcuts.',
  path: '/docs/piano-roll',
});

const SHORTCUTS: [string, string][] = [
  ['Delete / Backspace', 'Remove selected notes'],
  ['Ctrl+A / Cmd+A', 'Select all notes'],
  ['Ctrl+Z / Cmd+Z', 'Undo'],
  ['Ctrl+Shift+Z / Cmd+Shift+Z', 'Redo'],
  ['Shift+click', 'Add to multi-selection'],
  ['Click + drag (grid)', 'Move or create notes'],
  ['Right edge drag', 'Resize note duration'],
  ['Right-click (RMB) on note', 'Delete note'],
  ['E', 'Toggle piano roll vs sheet view (studio)'],
  ['D', 'Toggle chord detection overlay (studio)'],
  ['F', 'Enter fullscreen piano roll (when piano view is active)'],
  ['Esc', 'Exit fullscreen'],
];

export default function PianoRollDocPage() {
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
        Docs · Piano Roll
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
        Piano roll guide
      </h1>
      <DocLead>
        The piano roll is where you refine melody, chords, bass, or drums after generation. It is grid-snapped, velocity-aware, and works with a chord overlay
        when enabled.
      </DocLead>

      <DocH2>Note editing</DocH2>
      <DocP>
        Click on the grid to add notes; drag to move. Drag the right edge of a note to change length. Snapping follows the current beat resolution. Delete
        notes with the keyboard or context actions when available.
      </DocP>

      <DocH2>Velocity editing</DocH2>
      <DocP>
        The strip below the grid shows per-note velocity. Drag bars up or down to change dynamics, or drag across multiple bars to shape phrases. Velocity
        affects playback level before the mix engine.
      </DocP>

      <DocH2>Chord detection overlay</DocH2>
      <DocP>
        When chord overlay is on, the editor can show harmonic context derived from chord-layer notes (or the current layer), bar by bar. Use it to align
        melodies and bass lines with the progression you intend. On the generator page, press <DocCode>D</DocCode> to toggle the overlay when a variation is
        loaded.
      </DocP>

      <DocH2>Undo and redo</DocH2>
      <DocP>
        Every structural edit is tracked in a local history for that layer. Use standard undo/redo shortcuts to step through changes without leaving the
        editor.
      </DocP>

      <DocH2>Fullscreen mode</DocH2>
      <DocP>
        Press <DocCode>F</DocCode> while the piano view is focused to expand the editor for more vertical space. Press <DocCode>Esc</DocCode> or the on-screen
        control to exit fullscreen.
      </DocP>

      <DocH2>Keyboard shortcuts</DocH2>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="px-4 py-3"
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              >
                Shortcut
              </th>
              <th
                className="px-4 py-3"
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([keys, desc]) => (
              <tr key={keys} style={{ borderBottom: '1px solid var(--border)' }}>
                <td
                  className="px-4 py-3 align-top"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    color: 'rgba(240,240,255,0.88)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {keys}
                </td>
                <td className="px-4 py-3 align-top" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)' }}>
                  {desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocP>
        On Windows, use <DocCode>Ctrl</DocCode> where macOS uses <DocCode>Cmd</DocCode>. When focus is inside a text field, shortcuts are not intercepted.
      </DocP>
    </>
  );
}
