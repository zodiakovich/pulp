import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { pageMeta } from '@/lib/seo-metadata';
import { TranscribeClient } from './TranscribeClient';

export const metadata = pageMeta({
  title: 'Audio to MIDI',
  description: 'Transcribe WAV, MP3, or M4A audio to editable MIDI for piano-roll editing.',
  path: '/transcribe',
});

export default function TranscribePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="transcribe" />
      <TranscribeClient />
      <SiteFooter />
    </div>
  );
}
