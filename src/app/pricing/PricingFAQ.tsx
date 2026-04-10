'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'Is the MIDI royalty-free?',
    a: 'Yes. Everything you generate with pulp is 100% yours. No attribution required, commercial use included on Pro.',
  },
  {
    q: 'What DAWs does it work with?',
    a: 'FL Studio, Ableton Live, Logic Pro, GarageBand, Pro Tools, Cubase — any DAW that accepts .mid files.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your profile page anytime. You keep Pro access until the end of your billing period.',
  },
  {
    q: 'Do unused generations roll over?',
    a: 'No — free tier resets to 10 every month. Pro users never need to worry about limits.',
  },
];

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-[800px] mx-auto">
      {FAQS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.q}
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 py-5 text-left"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
            >
              <span
                className="font-semibold pr-2"
                style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, color: 'var(--foreground)' }}
              >
                {item.q}
              </span>
              <Chevron open={open} />
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
              style={{
                maxHeight: open ? 320 : 0,
                opacity: open ? 1 : 0,
              }}
            >
              <p
                className="pb-5 pr-10"
                style={{ fontSize: 15, color: 'var(--foreground-muted)', lineHeight: 1.65 }}
              >
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
