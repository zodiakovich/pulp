import type { Metadata } from 'next';

/** Dashboard route redirects to `/`; avoid indexing the URL. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
