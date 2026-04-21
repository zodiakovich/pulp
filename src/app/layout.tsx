import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { LazyVercelMetrics } from '@/components/LazyVercelMetrics';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import CrispChat from '@/components/CrispChat';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import { defaultDescription, ogImagePath, siteUrl } from '@/lib/seo';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  title: {
    default: 'pulp — AI MIDI Generator',
    template: '%s — pulp | AI MIDI Generator',
  },
  description: defaultDescription,
  manifest: '/manifest.json',
  openGraph: {
    title: 'pulp — AI MIDI Generator',
    description: defaultDescription,
    url: siteUrl,
    siteName: 'pulp',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: ogImagePath,
        width: 1200,
        height: 630,
        alt: 'pulp — AI MIDI Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pulp — AI MIDI Generator',
    description: defaultDescription,
    images: [ogImagePath],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0B' },
  ],
};

const THEME_BOOT_SCRIPT = `
(function () {
  var k = 'pulp_theme';
  var mode;
  try {
    var t = localStorage.getItem(k);
    if (t === 'light' || t === 'dark') mode = t;
    else mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch (e) {
    mode = 'dark';
  }
  var el = document.documentElement;
  el.classList.remove('dark', 'light');
  el.classList.add(mode);
  var meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#FAFAFA' : '#0A0A0B');
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
          <link rel="preconnect" href="https://composed-moth-91.clerk.accounts.dev" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://wakqmkbdeottfvgtezym.supabase.co" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://composed-moth-91.clerk.accounts.dev" />
          <link rel="dns-prefetch" href="https://wakqmkbdeottfvgtezym.supabase.co" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <link rel="preload" href="/fonts/syne-800-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          <meta id="theme-color" name="theme-color" content="#0A0A0B" />
        </head>
        <body className="min-h-screen font-body antialiased" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
          <SiteJsonLd />
          <ServiceWorkerRegister />
          <CrispChat />
          <ToastProvider>
            {children}
            <InstallPromptBanner />
          </ToastProvider>
          <LazyVercelMetrics />
        </body>
      </html>
    </ClerkProvider>
  );
}
