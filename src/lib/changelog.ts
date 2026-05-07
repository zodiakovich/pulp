export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.0',
    date: '2026-05-07',
    title: 'Blog, performance, and visual polish',
    changes: [
      'Blog launched — weekly production tips, MIDI guides, and genre breakdowns',
      'API prompt caching: faster generation starts across all AI routes',
      'Premium visual redesign: stronger contrast, branded gradient headline, deeper glows',
      'Real-time generation counter now displayed in the hero',
      'Footer and nav readability improvements across dark and light modes',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-05-01',
    title: 'Badges, avatars, and audio transcription',
    changes: [
      'Producer badge system — earn badges based on your generation history',
      'Custom avatar colors in profile settings',
      'Audio-to-MIDI transcription: upload audio, get editable MIDI back',
      'Embed mode for sharing a live generator in external pages',
      'Profile page redesigned with stats, recent generations, and plan details',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-04-23',
    title: 'Welcome to pulp Beta',
    changes: [
      'Professional piano roll — resize, move, multi-select, undo/redo',
      'Afro House genre with real audio samples and custom drum patterns',
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
      'Inspire mode and quick start templates',
      'Style tags and manual controls',
    ],
  },
];
