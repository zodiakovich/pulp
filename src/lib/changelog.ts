export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'Beta 0.1',
    date: '2026-04-23',
    title: 'Welcome to pulp Beta',
    changes: [
      'Professional piano roll — resize, move, multi-select, undo/redo',
      '4 premium genres with real audio samples',
      'Export to MIDI, WAV, Ableton .als, MusicXML',
      'Share generations publicly with a link',
      'Studio plan: drag-to-DAW and MIDI upload',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-04-01',
    title: 'Initial release',
    changes: [
      'AI MIDI generation — melody, chords, bass, drums',
      '3 variations per generation',
      'Export MIDI Format 0/1, WAV, Ableton .als, MusicXML, JSON',
      'Clerk authentication',
      'Stripe subscription (Free / Pro / Studio)',
      'Generation history with favorites',
      'Public share links',
      'Collab sessions',
      'Inspire mode, Quick start templates',
      'Style tags and manual controls',
    ],
  },
];
