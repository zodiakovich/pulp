import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { pageMeta } from '@/lib/seo-metadata';
import { MidiGeneratorClient } from './MidiGeneratorClient';

export const metadata = pageMeta({
  title: 'MIDI Generator',
  description: 'Generate a single editable MIDI part from a prompt: melody, arp, bass line, pad, drums, chords, or counter-melody.',
  path: '/midi',
});

export default function MidiPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="midi" />
      <MidiGeneratorClient />
      <SiteFooter />
    </div>
  );
}
