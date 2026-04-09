import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pulp-4ubq.vercel.app'),
  title: 'pulp — AI MIDI Generator',
  description: 'Generate professional MIDI in seconds. Free.',
  manifest: '/manifest.json',
  themeColor: '#FF6D3F',
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
        <body className="min-h-screen font-body antialiased" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    var t = localStorage.getItem('pulp_theme');
                    if (t === 'light') {
                      document.documentElement.classList.remove('dark');
                    } else {
                      document.documentElement.classList.add('dark');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
          <ServiceWorkerRegister />
          <ToastProvider>{children}</ToastProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
