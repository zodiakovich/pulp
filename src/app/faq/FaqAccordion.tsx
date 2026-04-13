'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type FaqItem = { question: string; answer: React.ReactNode };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.question}
            className="rounded-2xl"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-opacity duration-200 hover:opacity-95"
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 600,
                fontSize: 16,
                letterSpacing: '-0.01em',
                lineHeight: 1.35,
                color: 'var(--text)',
              }}
              aria-expanded={open}
            >
              <span>{item.question}</span>
              <span
                aria-hidden
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  border: '1px solid var(--border)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  color: 'var(--muted)',
                }}
              >
                {open ? '−' : '+'}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="border-t px-5 pb-5 pt-2"
                    style={{ borderColor: 'var(--border)', fontSize: 15, lineHeight: 1.75, color: 'var(--muted)' }}
                  >
                    {item.answer}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
