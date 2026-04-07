import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ToastProvider } from '@/components/toast/ToastProvider';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pulp-4ubq.vercel.app'),
  title: 'pulp — AI MIDI Generator',
  description: 'Generate professional MIDI in seconds. Free.',
  openGraph: {
    title: 'pulp — AI MIDI Generator',
    description: 'Generate professional MIDI in seconds. Free.',
    url: 'https://pulp-4ubq.vercel.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'pulp — AI MIDI Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pulp — AI MIDI Generator',
    description: 'Generate professional MIDI in seconds. Free.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg font-body text-[#F0F0FF] antialiased">
          <ToastProvider>{children}</ToastProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
