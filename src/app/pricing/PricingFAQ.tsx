'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'Who owns the MIDI I export?',
    a: 'You can export standard MIDI files and use them in your own projects. For release and commercial terms, check the License page before publishing.',
  },
  {
    q: 'What DAWs does it work with?',
    a: 'Any DAW that imports standard .mid files, including Ableton Live, FL Studio, Logic Pro, Cubase, Reaper, and Studio One.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account; paid access stays active until the end of the billing period.',
  },
  {
    q: 'Do unused generations roll over?',
    a: 'No. Allowances reset each calendar month: 20 for Free, 150 for Pro, and 600 for Studio.',
  },
  {
    q: 'How does billing work?',
    a: 'Pro and Studio are billed through Stripe (monthly or annual); cancel anytime from your account.',
  },
  {
    q: 'Is my data private?',
    a: 'We process prompts to generate MIDI; retention is explained in our Privacy Policy.',
  },
];

const INITIAL_COUNT = 3;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        flexShrink: 0,
        color: 'var(--foreground-muted)',
        transition: 'transform 0.2s ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PricingFAQ() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const hasMore = FAQS.length > INITIAL_COUNT;
  const items = showAllQuestions ? FAQS : FAQS.slice(0, INITIAL_COUNT);

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      <div>
        {items.map(item => {
          const open = openKey === item.q;
          return (
            <div key={item.q} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-4 py-6 text-left"
                onClick={() => setOpenKey(open ? null : item.q)}
                aria-expanded={open}
              >
                <span
                  className="font-semibold pr-2"
                  style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--foreground)', lineHeight: 1.2 }}
                >
                  {item.q}
                </span>
                <Chevron open={open} />
              </button>
              <div
                className="overflow-hidden transition-[max-height,opacity] duration-200 ease-ui"
                style={{
                  maxHeight: open ? 120 : 0,
                  opacity: open ? 1 : 0,
                }}
              >
                <p className="pb-6 pr-10" style={{ fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.55 }}>
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && !showAllQuestions && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="text-sm font-medium px-6 py-3 rounded-xl transition-colors"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
              background: 'var(--surface)',
            }}
            onClick={() => setShowAllQuestions(true)}
          >
            More questions ({FAQS.length - INITIAL_COUNT})
          </button>
        </div>
      )}
    </div>
  );
}
