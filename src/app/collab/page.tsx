import CollabIndexClient from './CollabIndexClient';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Collab',
  description:
    'Start a real-time pulp collab session—share a link and jam on MIDI together. Sign in may be required to host or join.',
  path: '/collab',
});

export default function CollabIndexPage() {
  return <CollabIndexClient />;
}
