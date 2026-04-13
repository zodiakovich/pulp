import type { Metadata } from 'next';

/** Static shell; generator UI is client-only. */
export const dynamic = 'force-static';

/** Homepage-only canonical; other routes set their own in page metadata. */
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function HomeSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
