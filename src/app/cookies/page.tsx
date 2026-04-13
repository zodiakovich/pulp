import { LegalDocShell, LegalSection } from '@/components/legal/LegalDocShell';
import { pageMeta } from '@/lib/seo-metadata';

export const metadata = pageMeta({
  title: 'Cookie Policy',
  description:
    'Cookies and local storage used by pulp: Clerk sessions, theme and onboarding preferences, and analytics—grouped as essential vs optional.',
  path: '/cookies',
});

const LAST = 'April 13, 2026';

export default function CookiePolicyPage() {
  return (
    <LegalDocShell title="Cookie Policy" lastUpdated={LAST}>
      <p style={{ color: 'var(--muted)' }}>
        This page lists cookies and similar storage we use on pulp. “Cookies” here includes HTTP cookies, local storage, and comparable technologies in your
        browser.
      </p>

      <LegalSection title="Essential (required for the product)">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong style={{ color: 'var(--text)' }}>Clerk session cookies.</strong> Clerk sets cookies so you can stay signed in securely. Without them,
            authentication and account features will not work reliably.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Security and routing.</strong> Our host or middleware may set short-lived cookies or tokens needed for
            security (for example CSRF protection or session continuity).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Preferences (stored on your device)">
        <p>We store some choices in your browser so the app remembers them between visits:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong style={{ color: 'var(--text)' }}>Theme (`localStorage`).</strong> Key such as <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>pulp_theme</code> — stores
            “light” or “dark” so the UI matches your preference.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Onboarding / UI hints (`localStorage`).</strong> Keys like onboarding completion or dismissed banners so
            we do not repeat the same introduction every time.
          </li>
        </ul>
        <p className="pt-2">You can clear site data in your browser settings; the app may reset tours or preferences afterward.</p>
      </LegalSection>

      <LegalSection title="Optional / analytics">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong style={{ color: 'var(--text)' }}>Vercel Analytics & Speed Insights.</strong> May use cookies or similar identifiers to measure page views and
            performance in aggregate. These help us understand usage without tying every event to marketing profiles on our side.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Crisp (when chat loads).</strong> If you open support chat, Crisp may set cookies to maintain the
            conversation. Chat is loaded after idle time to reduce impact on first load.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>
          Use your browser’s cookie and site-data settings to block or delete cookies. Blocking essential cookies may prevent sign-in or break parts of the
          app. For more on how we use personal data, see our{' '}
          <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Privacy Policy
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocShell>
  );
}
