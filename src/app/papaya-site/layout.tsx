import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://bypapaya.com'),
  title: 'papaya. — AI-powered music production tools',
  description: 'AI-powered music production tools from papaya.',
  applicationName: 'papaya.',
  openGraph: {
    title: 'papaya. — AI-powered music production tools',
    description: 'AI-powered music production tools from papaya.',
    url: 'https://bypapaya.com',
    siteName: 'papaya.',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'papaya. — AI-powered music production tools',
    description: 'AI-powered music production tools from papaya.',
  },
  icons: {
    icon: [{ url: '/papaya-favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
};

export default function PapayaSiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
