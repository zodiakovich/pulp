import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Settings',
  description: 'Manage your pulp account: avatar, display name, export preferences, and subscription.',
  path: '/settings',
});

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
