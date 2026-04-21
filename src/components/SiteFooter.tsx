import Link from 'next/link';

type FooterLink = {
  label: string;
  href: string;
  muted?: boolean;
};

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="min-w-0">
      <div
        className="mb-5"
        style={{
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: 'var(--text)',
        }}
      >
        {title}
      </div>
      <ul className="flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.href + l.label} className="min-w-0">
            <Link
              href={l.href}
              className={[
                'block w-fit max-w-full truncate transition-opacity duration-200 ease-ui',
                l.muted ? 'opacity-[0.35] hover:opacity-[0.55]' : 'opacity-50 hover:opacity-80',
              ].join(' ')}
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 px-4 sm:px-8" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1280px] py-20 sm:py-24" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 gap-12 sm:gap-14 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 */}
          <div className="min-w-0">
            <div
              className="text-2xl"
              style={{
                fontFamily: 'Syne, system-ui, Segoe UI, sans-serif',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text)',
              }}
            >
              pulp
            </div>
            <div className="mt-4 space-y-2">
              <div
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  opacity: 0.5,
                }}
              >
                AI MIDI Generator
              </div>
              <div
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  opacity: 0.35,
                }}
              >
                a <span style={{ fontWeight: 700, opacity: 0.95 }}>papaya</span>
                <span style={{ color: 'var(--accent)', opacity: 0.9 }}>●</span> tool
              </div>
            </div>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: 'Generator', href: '/create' },
              { label: 'Piano Roll', href: '/create' },
              { label: 'Mix Engine', href: '/build' },
              { label: 'Templates', href: '/create' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Changelog', href: '/changelog' },
            ]}
          />

          <FooterCol
            title="Resources"
            links={[
              { label: 'Blog', href: '/blog' },
              { label: 'Documentation', href: '/docs' },
              { label: 'API (coming soon)', href: '/api-docs', muted: true },
              { label: 'DAW Setup Guides', href: '/docs/daw-setup' },
              { label: 'FAQ', href: '/faq' },
            ]}
          />

          <FooterCol
            title="Company"
            links={[
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' },
              { label: 'Twitter / X', href: '/twitter' },
              { label: 'Discord', href: '/discord', muted: true },
              { label: 'GitHub', href: '/github' },
            ]}
          />
        </div>

        <div className="mt-16" style={{ height: 1, background: 'var(--divider)' }} />

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontSize: 14,
              color: 'var(--text)',
              opacity: 0.5,
            }}
          >
            © 2026 papaya. All rights reserved.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Cookie Policy', href: '/cookies' },
              { label: 'License', href: '/legal/license' },
            ].map((l, i) => (
              <div key={l.href} className="flex items-center">
                <Link
                  href={l.href}
                  className="transition-opacity duration-200 ease-ui opacity-50 hover:opacity-80"
                  style={{
                    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--text)',
                    textDecoration: 'none',
                  }}
                >
                  {l.label}
                </Link>
                {i < 3 ? (
                  <span aria-hidden style={{ margin: '0 10px', opacity: 0.35, color: 'var(--muted)' }}>
                    ·
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

