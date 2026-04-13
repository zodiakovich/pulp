'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type StepId = 0 | 1 | 2;

type Props = {
  promptRef: React.RefObject<HTMLElement | null>;
  pianoRef: React.RefObject<HTMLElement | null>;
  exportRef: React.RefObject<HTMLElement | null>;
};

type Rect = { left: number; top: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function computeCardPos(target: Rect): { left: number; top: number; maxWidth: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 12;
  const maxWidth = Math.min(360, Math.max(260, Math.floor(vw * 0.32)));

  const rightSpace = vw - (target.left + target.width);
  const leftSpace = target.left;

  const preferRight = rightSpace >= maxWidth + 24;
  const preferLeft = !preferRight && leftSpace >= maxWidth + 24;

  let left = target.left + target.width + gap;
  if (preferLeft) left = target.left - maxWidth - gap;
  if (!preferRight && !preferLeft) left = clamp(target.left, 16, vw - maxWidth - 16);

  const cardH = 140; // rough, for vertical placement only
  let top = target.top + 6;
  if (top + cardH > vh - 16) top = target.top - cardH - gap;
  top = clamp(top, 16, vh - cardH - 16);

  return { left, top, maxWidth };
}

const STORAGE_KEY = 'pulp_onboarded';

export function OnboardingOverlay({ promptRef, pianoRef, exportRef }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepId>(0);

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number; maxWidth: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const targetEl = useMemo(() => {
    if (step === 0) return promptRef.current;
    if (step === 1) return pianoRef.current;
    return exportRef.current;
  }, [exportRef, pianoRef, promptRef, step]);

  const copy = useMemo(() => {
    if (step === 0) {
      return {
        title: 'Describe what you want',
        body: 'a genre, an artist, a vibe. pulp handles the rest.',
      };
    }
    if (step === 1) {
      return {
        title: 'Edit every note',
        body: 'adjust velocity, chords, melody — full control.',
      };
    }
    return {
      title: 'Export when you’re ready',
      body: 'export MIDI or WAV. drag it straight into your DAW.',
    };
  }, [step]);

  const markDone = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  };

  const close = () => {
    setOpen(false);
    markDone();
  };

  const next = () => {
    if (step === 2) {
      close();
      return;
    }
    setStep((s) => (s === 0 ? 1 : 2));
  };

  const recalc = () => {
    if (!targetEl) return;
    const r = getRect(targetEl);
    setTargetRect(r);
    setCardPos(computeCardPos(r));
  };

  useEffect(() => {
    let shouldOpen = false;
    try {
      shouldOpen = localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      shouldOpen = true;
    }
    if (shouldOpen) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!targetEl) return;

    // Bring the relevant section into view (softly).
    try {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // ignore
    }

    recalc();

    const on = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        recalc();
      });
    };

    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, targetEl]);

  if (!open || !targetRect || !cardPos) return null;

  const dots = [0, 1, 2] as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
      {/* Spotlight cutout */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: targetRect.left - 6,
          top: targetRect.top - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          borderRadius: 16,
          boxShadow: '0 0 0 9999px rgba(10,10,11,0.14)',
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.02)',
        }}
      />

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="glass-elevated card-tilt-hover rounded-2xl p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.24, ease: [0.55, 0, 1, 0.45] } }}
          transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
          style={{
            position: 'fixed',
            left: cardPos.left,
            top: cardPos.top,
            maxWidth: cardPos.maxWidth,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(240,240,255,0.92)', lineHeight: 1.35 }}>
            <span style={{ fontWeight: 600 }}>{copy.title}</span>{' '}
            <span style={{ color: 'rgba(138,138,154,0.95)', fontWeight: 400 }}>{copy.body}</span>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={next}
              style={{
                pointerEvents: 'auto',
                border: 'none',
                background: 'transparent',
                color: 'rgba(240,240,255,0.86)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              Next
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
              {dots.map((d) => (
                <span
                  key={d}
                  aria-hidden
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: d === step ? 'rgba(240,240,255,0.75)' : 'rgba(138,138,154,0.35)',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={close}
              style={{
                marginLeft: 'auto',
                pointerEvents: 'auto',
                border: 'none',
                background: 'transparent',
                color: 'rgba(138,138,154,0.65)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

