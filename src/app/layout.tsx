import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { LazyVercelMetrics } from '@/components/LazyVercelMetrics';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import CrispChat from '@/components/CrispChat';
import { NavigationProgress } from '@/components/NavigationProgress';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import { defaultDescription, ogImagePath, siteUrl } from '@/lib/seo';
import { SentryErrorBoundary } from '@/components/SentryErrorBoundary';
import { PostHogProvider } from '@/components/PostHogProvider';
import { PostHogIdentify } from '@/components/PostHogIdentify';
import { StopAudioOnRouteChange } from '@/components/StopAudioOnRouteChange';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  title: {
    default: 'Pulp — AI MIDI Generator (Beta)',
    template: '%s — Pulp | AI MIDI Generator',
  },
  description: defaultDescription,
  manifest: '/manifest.json',
  openGraph: {
    title: 'Pulp — AI MIDI Generator (Beta)',
    description: 'Generate professional multi-track MIDI from text prompts — now in beta. Melody, chords, bass, and drums in seconds. Ready for any DAW.',
    url: siteUrl,
    siteName: 'Pulp',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Pulp — AI MIDI Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulp — AI MIDI Generator (Beta)',
    description: 'Generate professional multi-track MIDI from text prompts — now in beta. Melody, chords, bass, and drums in seconds.',
    images: ['/opengraph-image'],
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

const CLERK_JS_URL =
  process.env.NEXT_PUBLIC_CLERK_JS_URL ||
  'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      clerkJSUrl={CLERK_JS_URL}
      appearance={{
        // Enable Google, Apple, and GitHub in Clerk Dashboard:
        // Dashboard → User & Authentication → Social Connections
        // Recommended order: Google → Apple → GitHub
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
        },
        variables: {
          colorBackground: '#0F0F12',
          colorText: '#FFFFFF',
          colorTextSecondary: '#8A8A9A',
          colorPrimary: '#FF6D3F',
          colorInputBackground: '#1A1A1E',
          colorInputText: '#FFFFFF',
          borderRadius: '12px',
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        },
        elements: {
          card: {
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          },
          socialButtonsBlockButton: {
            borderRadius: '10px',
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 500,
          },
          socialButtonsBlockButton__google: {
            background: '#FFFFFF',
            color: '#1F1F1F',
            border: '1px solid rgba(0,0,0,0.12)',
          },
          socialButtonsBlockButton__apple: {
            background: '#000000',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.12)',
          },
          socialButtonsBlockButton__github: {
            background: '#24292F',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.18)',
          },
          dividerText: {
            color: '#8A8A9A',
            fontSize: '13px',
          },
          userButtonPopoverCard: {
            backgroundColor: '#1A1A2E',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          userButtonPopoverActionButton: {
            color: '#FAFAFA !important',
          },
          userButtonPopoverActionButton__manageAccount: {
            color: '#FAFAFA !important',
          },
          userButtonPopoverActionButton__signOut: {
            color: '#FAFAFA !important',
          },
          userButtonPopoverActionButtonText: {
            color: '#FAFAFA !important',
          },
          userButtonPopoverActionButtonIcon: {
            color: '#FAFAFA !important',
          },
          userButtonPopoverFooter: {
            display: 'none',
          },
          userPreviewMainIdentifier: {
            color: 'rgba(255,255,255,0.9)',
          },
          userPreviewSecondaryIdentifier: {
            color: 'rgba(255,255,255,0.5)',
          },
        },
      }}
    >
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
          <PostHogProvider />
          <PostHogIdentify />
          <StopAudioOnRouteChange />
          <SiteJsonLd />
          <ServiceWorkerRegister />
          <CrispChat />
          <NavigationProgress />
          <SentryErrorBoundary>
            <ToastProvider>
              {children}
              <InstallPromptBanner />
            </ToastProvider>
          </SentryErrorBoundary>
          <LazyVercelMetrics />
        </body>
      </html>
    </ClerkProvider>
  );
}
