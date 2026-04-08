export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2',
    date: '2026-04-08',
    title: 'Live Mode + Audio to MIDI',
    description: 'Jam in real time and convert any sample to MIDI',
  },
  {
    version: '1.1',
    date: '2026-04-01',
    title: 'Inspire from songs',
    description: 'Type any artist or song and pulp matches the vibe',
  },
  {
    version: '1.0',
    date: '2026-03-25',
    title: 'pulp launches',
    description: 'AI MIDI generator with 20 genres and 4 independent tracks',
  },
];

