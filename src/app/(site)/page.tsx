'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useState, useCallback, useRef, useEffect, useMemo, type DragEvent } from 'react';
import { motion, AnimatePresence, type Variants, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { SignInButtonDeferred } from '@/components/ClerkAuthDeferred';
import {
  generateTrack, getDefaultParams, GENRES, STYLE_TAGS, parsePrompt, MANUAL_SCALE_OPTIONS, SCALE_INTERVALS,
  type GenerationParams, type GenerationResult, type NoteEvent,
} from '@/lib/music-engine';
import { generateMidiFormat0, generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';
import { playNotesWithMix as playNotes, renderNotesWithMixToWav } from '@/lib/mix-engine';
import { playAll, playTonePreview, updateAllMixer } from '@/lib/tone-lazy';
import { stopAllAppAudio, subscribeToAudioStop } from '@/lib/audio-control';
import { applyHumanization } from '@/lib/humanize';
import type { LayerFXSettings, AllLayerFX } from '@/lib/fx-settings';
import { DEFAULT_FX } from '@/lib/fx-settings';
import type { AllMixerState, MixerLayerState } from '@/lib/mixer-settings';
import { makeDefaultMixer, computeEffectiveGain } from '@/lib/mixer-settings';
import { generateAutoTags } from '@/lib/auto-tags';
import { MatchSoundsPanel } from '@/components/MatchSoundsPanel';
import { getAfroHouseSampleOptions, setAfroHouseOverride, type AfroHouseSlot, type AfroHouseSampleOptions } from '@/lib/afro-house-samples';
import { useSupabaseWithClerk } from '@/lib/supabase-clerk-browser';
import { track } from '@vercel/analytics';
import { posthog } from '@/components/PostHogProvider';
import { Skeleton, SkeletonText } from '@/components/Skeleton';
import { useToast } from '@/components/toast/useToast';
import { generateAbletonAlsBlob } from '@/lib/ableton-export';
import { mapArtistProfileToHints, resolveArtistPromptChain } from '@/lib/artist-resolver';
import { loadPreferences } from '@/lib/user-preferences';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import type { MidiUploadSuccessPayload } from '@/components/StudioMidiUploadModal';
import { EmptyState } from '@/components/EmptyState';
import { ButtonLoadingDots } from '@/components/ButtonLoadingDots';
import { SiteFooter } from '@/components/SiteFooter';
import { CustomSelect } from '@/components/CustomSelect';

const PianoRollEditor = dynamic(
  () => import('@/components/PianoRollEditor').then(m => ({ default: m.PianoRollEditor })),
  { ssr: false },
);
const StepSequencer = dynamic(
  () => import('@/components/StepSequencer').then(m => ({ default: m.StepSequencer })),
  { ssr: false },
);
const OnboardingOverlay = dynamic(
  () => import('@/components/OnboardingOverlay').then(m => ({ default: m.OnboardingOverlay })),
  { ssr: false },
);
const StudioMidiUploadModal = dynamic(
  () => import('@/components/StudioMidiUploadModal').then(m => ({ default: m.StudioMidiUploadModal })),
  { ssr: false },
);
const StudioAudioToMidiModal = dynamic(
  () => import('@/components/StudioAudioToMidiModal').then(m => ({ default: m.StudioAudioToMidiModal })),
  { ssr: false },
);
import type { PlanType } from '@/lib/credits';
import { DS, LAYER_VIZ_COLORS, readCssColor, getLayerVizColorsForCanvas } from '@/lib/design-system';
import { useColorScheme } from '@/hooks/useColorScheme';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// ─── MOTION VARIANTS ─────────────────────────────────────────
/** Default UI easing — hover, enters, in-view */
const EASE_UI = [0.23, 1, 0.32, 1] as const;
/** Exit / dismiss */
const EASE_EXIT = [0.55, 0, 1, 0.45] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_UI } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_UI } },
};

const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const scrollSection = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 },
  transition: { duration: 0.4, ease: EASE_UI },
} as const;

const CLERK_BOOT_TIMEOUT_MS = 12000;


const QUICK_START_TEMPLATES: {
  name: string;
  subtitle: string;
  prompt: string;
  preset: Pick<GenerationParams, 'genre' | 'bpm' | 'key' | 'scale'>;
}[] = [
  {
    name: 'Acid Drop',
    subtitle: '138 BPM · Minor · Driving melody + acid bass',
    prompt: 'acid techno groove, 138bpm, minor key, driving melody, 303 acid bass, tight hats, warehouse energy',
    preset: { genre: 'hard_techno', bpm: 138, key: 'A', scale: 'minor' },
  },
  {
    name: 'UK Garage',
    subtitle: '132 BPM · Minor · Shuffle drums + vocal chops',
    prompt: 'UK garage groove, 132bpm, minor, shuffling drums, swung hats, warm chords, chopped hooks, bouncy bass',
    preset: { genre: 'uk_garage', bpm: 132, key: 'F', scale: 'minor' },
  },
  {
    name: 'Deep Hypnotic',
    subtitle: '124 BPM · Minor · Minimal drums + evolving chords',
    prompt: 'deep hypnotic minimal techno, 124bpm, minor, restrained drums, evolving chords, subtle movement, late-night',
    preset: { genre: 'minimal_tech', bpm: 124, key: 'D', scale: 'minor' },
  },
  {
    name: 'Bouncy Funk',
    subtitle: '126 BPM · Major · Funky bass + bright stabs',
    prompt: 'bouncy funky house, 126bpm, major key, punchy bassline, bright chord stabs, playful rhythm, tight groove',
    preset: { genre: 'tech_house', bpm: 126, key: 'G', scale: 'major' },
  },
  {
    name: 'Melodic Techno',
    subtitle: '128 BPM · Minor · Emotional chords + wide lead',
    prompt: 'melodic techno, 128bpm, minor, emotional chord progression, wide lead melody, driving kick, clean low end',
    preset: { genre: 'melodic_techno', bpm: 128, key: 'C', scale: 'minor' },
  },
  {
    name: 'Afro Pulse',
    subtitle: '122 BPM · Minor · Percussion swing + warm bass',
    prompt: 'afro house pulse, 122bpm, minor, percussive swing, warm bass, organic groove, airy tops, rolling rhythm',
    preset: { genre: 'afro_house', bpm: 122, key: 'E', scale: 'minor' },
  },
  {
    name: 'Lo‑Fi Chill',
    subtitle: '82 BPM · Minor · Soft chords + lazy drums',
    prompt: 'lo-fi chillout, 82bpm, minor, soft chords, lazy drums, mellow melody, tape warmth, relaxed',
    preset: { genre: 'lofi_hiphop', bpm: 82, key: 'A', scale: 'minor' },
  },
  {
    name: 'Dark Minimal',
    subtitle: '126 BPM · Minor · Sparse rhythm + tension',
    prompt: 'dark minimal groove, 126bpm, minor, sparse drum pattern, tension, tight bass, short motifs, focused',
    preset: { genre: 'minimal_tech', bpm: 126, key: 'F', scale: 'minor' },
  },
  {
    name: 'Euphoric Trance',
    subtitle: '140 BPM · Minor · Big chords + soaring lead',
    prompt: 'euphoric trance, 140bpm, minor, big chord progression, soaring lead melody, energetic drums, uplifting',
    preset: { genre: 'trance', bpm: 140, key: 'D', scale: 'minor' },
  },
  {
    name: 'Broken Beat',
    subtitle: '126 BPM · Minor · Broken drums + jazzy chords',
    prompt: 'broken beat, 126bpm, minor, broken drum groove, syncopation, jazzy chords, snappy bass, swing',
    preset: { genre: 'uk_garage', bpm: 126, key: 'G', scale: 'minor' },
  },
];

// ─── TYPES ───────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  prompt: string;
  genre: string;
  key: string;
  scale: string;
  bpm: number;
  bars: number;
  result: GenerationResult;
  params: GenerationParams;
  timestamp: Date;
}

function formatTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function guessKeyFromLayers(layers: GenerationResult): string {
  const pitches = [
    ...(layers.melody ?? []).map(n => n.pitch),
    ...(layers.chords ?? []).map(n => n.pitch),
    ...(layers.bass ?? []).map(n => n.pitch),
  ];
  if (pitches.length === 0) return '—';
  const counts = new Array(12).fill(0) as number[];
  for (const p of pitches) counts[((p % 12) + 12) % 12] += 1;
  const best = counts.reduce((bi, v, i) => (v > counts[bi]! ? i : bi), 0);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[best] ?? '—';
}

function MiniPianoRollThumb({ layers }: { layers: GenerationResult }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const colorScheme = useColorScheme();
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 220;
    const h = canvas.clientHeight || 48;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cv = getLayerVizColorsForCanvas();
    ctx.fillStyle = readCssColor('--bg', '#0A0A0B');
    ctx.fillRect(0, 0, w, h);

    const all = [
      ...(layers.melody ?? []).map(n => ({ n, c: cv.melody })),
      ...(layers.chords ?? []).map(n => ({ n, c: cv.chords })),
      ...(layers.bass ?? []).map(n => ({ n, c: cv.bass })),
      ...(layers.drums ?? []).map(n => ({ n, c: cv.drums })),
    ];
    if (all.length === 0) return;
    const bars = 4;
    const totalBeats = bars * 4;
    const pitches = all.map(x => x.n.pitch);
    const minP = Math.max(24, Math.min(...pitches));
    const maxP = Math.min(108, Math.max(...pitches));
    const range = Math.max(1, maxP - minP + 1);
    for (const { n, c } of all) {
      const x0 = (n.startTime / totalBeats) * w;
      const x1 = ((n.startTime + n.duration) / totalBeats) * w;
      const y = (1 - (n.pitch - minP) / range) * (h - 10) + 5;
      const ww = Math.max(1.5, x1 - x0);
      const hh = 3.5;
      ctx.globalAlpha = 0.2 + (n.velocity / 127) * 0.8;
      ctx.fillStyle = c;
      ctx.fillRect(x0, y - hh / 2, ww, hh);
      ctx.globalAlpha = 1;
    }
  }, [layers, colorScheme]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 48, display: 'block', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border-weak)' }}
    />
  );
}

// ─── ONBOARDING TOOLTIP ───────────────────────────────────────
function ClerkConnectionFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-[520px]"
        style={{
          border: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          borderRadius: 18,
          padding: 28,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: '2px solid rgba(255,109,63,0.16)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 18,
          }}
        />
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--text-micro)',
            marginBottom: 10,
          }}
        >
          CONNECTING
        </div>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          We&apos;re having trouble reaching Clerk.
        </h1>
        <p
          style={{
            marginTop: 12,
            marginBottom: 20,
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontSize: 15,
            lineHeight: 1.65,
            color: 'var(--muted)',
            maxWidth: 440,
          }}
        >
          The app is waiting on authentication to come online. If the custom domain is still resolving, reload the page or try again in a moment.
        </p>
        <button type="button" className="btn-primary" onClick={onRetry} style={{ height: 44, padding: '0 18px' }}>
          Retry
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function OnboardingTooltip({
  title,
  body,
  stepLabel,
  targetRect,
  canNext,
  onNext,
  onSkip,
}: {
  title: string;
  body: string;
  stepLabel: string;
  targetRect: DOMRect | null;
  canNext: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  if (!targetRect) return null;

  const pad = 12;
  const maxW = 340;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const centerX = targetRect.left + targetRect.width / 2;
  const left = Math.min(vw - maxW - pad, Math.max(pad, centerX - maxW / 2));
  const preferBelow = targetRect.top < vh * 0.5;
  const top = preferBelow
    ? Math.min(vh - 160, targetRect.bottom + 12)
    : Math.max(pad, targetRect.top - 140);

  const arrowLeft = Math.min(maxW - 20, Math.max(20, centerX - left));
  const arrowTop = preferBelow ? -6 : undefined;
  const arrowBottom = preferBelow ? undefined : -6;

  return (
    <>
      {/* spotlight ring */}
      <div
        className="fixed z-[95] pointer-events-none"
        style={{
          left: targetRect.left - 6,
          top: targetRect.top - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          borderRadius: 16,
          border: '1px solid rgba(255,109,63,0.55)',
          boxShadow: `0 0 0 9999px rgba(10,10,11,0.55)`,
        }}
      />

      <motion.div
        className="fixed z-[96]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: EASE_UI }}
        style={{
          left,
          top,
          width: maxW,
          background: DS.surface,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${DS.border}`,
          borderRadius: 16,
          padding: 16,
          pointerEvents: 'auto',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: arrowLeft,
            width: 12,
            height: 12,
            background: 'var(--surface)',
            borderLeft: `1px solid ${DS.border}`,
            borderTop: `1px solid ${DS.border}`,
            transform: 'translateX(-50%) rotate(45deg)',
            top: arrowTop,
            bottom: arrowBottom,
          }}
        />

        <div className="flex items-center justify-between gap-4 mb-2">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-micro)', letterSpacing: '0.08em' }}>
            {stepLabel}
          </span>
          <button
            onClick={onSkip}
            className="text-xs transition-colors"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Skip
          </button>
        </div>

        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>
          {title}
        </p>
        <p className="mt-2" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
          {body}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onNext}
            disabled={!canNext}
            className="h-9 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(255,109,63,0.12)',
              border: '1px solid rgba(255,109,63,0.35)',
              color: DS.accent,
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.outline = '2px solid rgba(255,109,63,0.25)')}
            onBlur={e => (e.currentTarget.style.outline = 'none')}
          >
            Next
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── SPOTLIGHT BUTTON ─────────────────────────────────────────
interface SpotlightButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

function SpotlightButton({ children, style, disabled, ...rest }: SpotlightButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, show: false });

  return (
    <button
      ref={ref}
      disabled={disabled}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
      onMouseMove={e => {
        if (disabled) return;
        const r = ref.current?.getBoundingClientRect();
        if (r) setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, show: true });
      }}
      onMouseLeave={() => setSpot(s => ({ ...s, show: false }))}
      {...rest}
    >
      {spot.show && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: spot.x, top: spot.y,
            transform: 'translate(-50%, -50%)',
            width: 130, height: 130,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </button>
  );
}

// ─── PIANO ROLL ───────────────────────────────────────────────
function PianoRoll({ notes, color, height = 88 }: { notes: NoteEvent[]; color: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || notes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = readCssColor('--piano-roll-bg', '#0A0A0B');
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = readCssColor('--piano-roll-viz-grid', 'rgba(255,255,255,0.05)');
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += w / 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const pitches = notes.map(n => n.pitch);
    const minPitch = Math.min(...pitches) - 1;
    const maxPitch = Math.max(...pitches) + 1;
    const pitchRange = Math.max(maxPitch - minPitch, 8);
    const maxTime = Math.max(...notes.map(n => n.startTime + n.duration), 4);

    const resolvedColor = (() => {
      const m = String(color ?? '').match(/var\((--[^)]+)\)/);
      if (!m) return color;
      return readCssColor(m[1]!, color);
    })();

    for (const note of notes) {
      const x = (note.startTime / maxTime) * w;
      const noteW = Math.max(2, (note.duration / maxTime) * w);
      const y = h - ((note.pitch - minPitch) / pitchRange) * h;
      const noteH = Math.max(2, (h / pitchRange) * 0.8);

      ctx.fillStyle = resolvedColor;
      ctx.globalAlpha = 0.5 + (note.velocity / 127) * 0.5;
      ctx.beginPath();
      const rx = x, ry = y - noteH / 2, rw = noteW, rh = noteH, r = 1.5;
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [notes, color, height, colorScheme]);

  return (
    <canvas ref={canvasRef} className="w-full rounded-md piano-roll" style={{ height }} />
  );
}

// ─── LAYER COLORS (strict palette) ────────────────────────────
const LAYER_COLORS: Record<string, string> = LAYER_VIZ_COLORS;

const LAYERS = ['melody', 'chords', 'bass', 'drums'] as const;
const EDITOR_LAYERS = [...LAYERS, 'imported'] as const;

// ─── INSTRUMENT SELECTORS ─────────────────────────────────────
const LAYER_INSTRUMENT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  melody: [
    { label: 'Piano',         value: 'acoustic_grand_piano' },
    { label: 'Electric Piano', value: 'electric_piano_1' },
    { label: 'Strings',       value: 'string_ensemble_1' },
    { label: 'Synth Lead',    value: 'lead_2_sawtooth' },
    { label: 'Marimba',       value: 'marimba' },
    { label: 'Vibraphone',    value: 'vibraphone' },
  ],
  chords: [
    { label: 'Strings',       value: 'string_ensemble_1' },
    { label: 'Pad',           value: 'pad_2_warm' },
    { label: 'Piano',         value: 'acoustic_grand_piano' },
    { label: 'Electric Piano', value: 'electric_piano_1' },
    { label: 'Church Organ',  value: 'church_organ' },
    { label: 'Rhodes',        value: 'electric_piano_1' },
  ],
  bass: [
    { label: 'Electric Bass', value: 'electric_bass_finger' },
    { label: 'Upright Bass',  value: 'acoustic_bass' },
    { label: 'Synth Bass',    value: 'lead_1_square' },
    { label: 'Tuba',          value: 'tuba' },
  ],
};

const DEFAULT_LAYER_INSTRUMENTS: Record<string, string> = {
  melody: 'acoustic_grand_piano',
  chords: 'string_ensemble_1',
  bass:   'electric_bass_finger',
};

function reverseNotes(notes: NoteEvent[]): NoteEvent[] {
  if (notes.length === 0) return notes;
  const totalDuration = Math.max(...notes.map(n => n.startTime + n.duration));
  return notes
    .map(n => ({ ...n, startTime: totalDuration - (n.startTime + n.duration) }))
    .sort((a, b) => a.startTime - b.startTime);
}

function makeDraggableMidi(notes: NoteEvent[], bpm: number, filename: string) {
  const midi = generateMidiFormat0(notes, bpm, filename);
  const ab = new ArrayBuffer(midi.byteLength);
  new Uint8Array(ab).set(midi);
  const blob = new Blob([ab], { type: 'audio/midi' });
  return { blob, filename };
}

// ─── LAYER CARD ───────────────────────────────────────────────
function LayerCard({
  name, notes, bpm, genre, enabled, onDownload, onRegenerate, instrument, onInstrumentChange,
  fxOpen, onFXToggle, onFXChange,
  volume, muted, soloed, onVolumeChange, onMuteToggle, onSoloToggle,
  reversed, onReverse,
}: {
  name: string; notes: NoteEvent[]; bpm: number; genre: string;
  enabled: boolean; onDownload: () => void; onRegenerate: () => void;
  instrument?: string; onInstrumentChange?: (v: string) => void;
  fxOpen?: boolean; onFXToggle?: () => void; onFXChange?: (fx: LayerFXSettings) => void;
  volume?: number; muted?: boolean; soloed?: boolean;
  onVolumeChange?: (v: number) => void; onMuteToggle?: () => void; onSoloToggle?: () => void;
  reversed?: boolean; onReverse?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [fxSettings, setFxSettings] = useState<LayerFXSettings>({ ...DEFAULT_FX });
  const updateFX = (patch: Partial<LayerFXSettings>) => {
    const next = { ...fxSettings, ...patch };
    setFxSettings(next);
    onFXChange?.(next);
  };
  const [dragging, setDragging] = useState(false);
  const color = LAYER_COLORS[name] || DS.accent;
  const instrumentOptions = LAYER_INSTRUMENT_OPTIONS[name] ?? [];
  const isAfroHouse = genre === 'afro_house' || genre === 'afro-house';
  const pitchRange = notes.length > 0
    ? `${Math.min(...notes.map(n => n.pitch))}-${Math.max(...notes.map(n => n.pitch))}`
    : 'empty';
  const activeTools = [
    muted ? 'muted' : null,
    soloed ? 'solo' : null,
    reversed ? 'reversed' : null,
    fxOpen ? 'fx open' : null,
  ].filter((item): item is string => Boolean(item));

  const [ahOptions, setAhOptions] = useState<AfroHouseSampleOptions | null>(null);
  const [ahKick, setAhKick] = useState('');
  const [ahSnare, setAhSnare] = useState('');
  const [ahHat, setAhHat] = useState('');
  const [ahBass, setAhBass] = useState('');
  const [ahSynth, setAhSynth] = useState('');

  useEffect(() => {
    if (!isAfroHouse) return;
    void getAfroHouseSampleOptions().then(setAhOptions);
  }, [isAfroHouse]);

  useEffect(() => subscribeToAudioStop(() => setPlaying(false)), []);

  const previewLayer =
    name === 'drums' ? 'drums' :
    name === 'bass'  ? 'bass'  :
    name === 'chords'? 'chords': 'melody';

  const handleAfroSelect = (slot: AfroHouseSlot, value: string) => {
    setAfroHouseOverride(slot, value || null);
    if (slot === 'kick')      setAhKick(value);
    else if (slot === 'snare')     setAhSnare(value);
    else if (slot === 'closedHat') setAhHat(value);
    else if (slot === 'bass')      setAhBass(value);
    else if (slot === 'synth')     setAhSynth(value);
    stopAllAppAudio();
    setPlaying(true);
    void playTonePreview(notes, bpm, previewLayer, genre, () => setPlaying(false));
  };

  const handlePlay = async () => {
    if (playing) { stopAllAppAudio(); setPlaying(false); return; }
    stopAllAppAudio();
    setPlaying(true);
    await playTonePreview(notes, bpm, previewLayer, genre, () => setPlaying(false), instrument, fxSettings, (volume ?? 75) / 100);
  };

  const compactSelectStyle: React.CSSProperties = { maxWidth: 140, fontSize: 11 };

  return (
    <motion.div
      variants={fadeUp}
      className={`layer-card active-${name}${!enabled ? ' opacity-40' : ''}`}
      draggable={enabled && notes.length > 0}
      onDragStartCapture={(e: DragEvent<HTMLDivElement>) => {
        if (!enabled || notes.length === 0) return;
        setDragging(true);
        const { blob, filename: fname } = makeDraggableMidi(notes, bpm, `pulp-${name}`);
        const file = new File([blob], `${fname}.mid`, { type: 'audio/midi' });
        const dt = e.dataTransfer;
        dt.effectAllowed = 'copy';
        dt.items.add(file);
      }}
      onDragEndCapture={() => setDragging(false)}
      style={{
        cursor: enabled && notes.length > 0 ? (dragging ? 'grabbing' : 'grab') : 'default',
        border: dragging ? `1px solid ${DS.accent}` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="mt-1 h-10 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 18px ${color}55` }}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold capitalize leading-tight" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {name}
              </p>
              {activeTools.map(item => (
                <span
                  key={item}
                  className="rounded-md px-1.5 py-0.5"
                  style={{ border: '1px solid rgba(255,109,63,0.28)', color: '#FF6D3F', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="variation-stat">{notes.length} notes</span>
              <span className="variation-stat">range {pitchRange}</span>
              <span className="variation-stat">{bpm} BPM</span>
            </div>
            {/* Soundfont instrument selector (non-afro-house) */}
            {instrumentOptions.length > 0 && onInstrumentChange && !isAfroHouse && (
              <CustomSelect
                value={instrument ?? ''}
                onChange={v => { onInstrumentChange(v); }}
                options={instrumentOptions}
                onClick={e => e.stopPropagation()}
                className="mt-1.5"
                style={compactSelectStyle}
              />
            )}
            {/* Afro-house sample selectors */}
            {isAfroHouse && ahOptions && name !== 'drums' && (
              <CustomSelect
                value={name === 'bass' ? ahBass : ahSynth}
                onChange={v => handleAfroSelect(name === 'bass' ? 'bass' : 'synth', v)}
                options={name === 'bass' ? ahOptions.bass : ahOptions.synth}
                onClick={e => e.stopPropagation()}
                className="mt-1.5"
                style={compactSelectStyle}
              />
            )}
            {isAfroHouse && ahOptions && name === 'drums' && (
              <div className="mt-1.5 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                {([
                  { label: 'Kick',  slot: 'kick'      as AfroHouseSlot, opts: ahOptions.kicks,      val: ahKick  },
                  { label: 'Snare', slot: 'snare'     as AfroHouseSlot, opts: ahOptions.snares,     val: ahSnare },
                  { label: 'HH',    slot: 'closedHat' as AfroHouseSlot, opts: ahOptions.closedHats, val: ahHat   },
                ] as const).map(({ label, slot, opts, val }) => (
                  <div key={slot} className="flex items-center gap-1.5">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', width: 32, flexShrink: 0 }}>{label}</span>
                    <CustomSelect
                      value={val}
                      onChange={v => handleAfroSelect(slot, v)}
                      options={opts}
                      style={{ maxWidth: 110, fontSize: 10 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            onClick={handlePlay}
            disabled={!enabled || notes.length === 0}
            className="h-8 px-2.5 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title={playing ? 'Stop' : 'Play'}
          >
            {playing ? 'Stop' : 'Play'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={!enabled}
            className="h-8 px-2.5 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title={`Regenerate ${name}`}
          >
            ↻
          </button>
          <button
            onClick={onDownload}
            disabled={!enabled || notes.length === 0}
            className="h-8 px-2.5 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,184,148,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title="Download .mid"
          >
            ↓
          </button>
          {/* FX toggle */}
          <button
            onClick={onFXToggle}
            className="h-8 px-2 flex items-center justify-center rounded-lg text-xs transition-all"
            style={{
              border: fxOpen ? '1px solid rgba(255,109,63,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: fxOpen ? '#FF6D3F' : 'var(--muted)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: fxOpen ? 'rgba(255,109,63,0.08)' : 'transparent',
              transition: 'border-color 150ms, color 150ms, background 150ms',
            }}
            onMouseEnter={e => { if (!fxOpen) { e.currentTarget.style.borderColor = 'rgba(255,109,63,0.35)'; e.currentTarget.style.color = '#FF6D3F'; } }}
            onMouseLeave={e => { if (!fxOpen) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--muted)'; } }}
            title="Effects rack"
          >
            FX
          </button>
          {/* Reverse */}
          {onReverse && (
            <button
              onClick={onReverse}
              disabled={!enabled || notes.length === 0}
              className="h-8 px-2.5 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
              style={{
                border: reversed ? '1px solid rgba(255,109,63,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: reversed ? '#FF6D3F' : 'var(--muted)',
                background: reversed ? 'rgba(255,109,63,0.08)' : 'transparent',
                transition: 'border-color 150ms, color 150ms, background 150ms',
              }}
              onMouseEnter={e => { if (!reversed) { e.currentTarget.style.borderColor = 'rgba(255,109,63,0.35)'; e.currentTarget.style.color = '#FF6D3F'; } }}
              onMouseLeave={e => { if (!reversed) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--muted)'; } }}
              title="Reverse notes"
            >
              ↔
            </button>
          )}
        </div>
      </div>
      {/* Mixer row */}
      {onVolumeChange && (
        <div
          className="mt-3 mb-3 rounded-xl px-3 py-2"
          style={{ border: '1px solid var(--border-weak)', background: 'rgba(255,255,255,0.025)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>
              MIX
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: muted ? 'rgba(255,255,255,0.25)' : color }}>
              {volume ?? 75}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMuteToggle}
            title={muted ? 'Unmute' : 'Mute'}
            style={{
              height: 22,
              padding: '0 7px',
              borderRadius: 4,
              border: muted ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
              color: muted ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.38)',
              background: muted ? 'rgba(255,255,255,0.10)' : 'transparent',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'border-color 120ms, color 120ms, background 120ms',
            }}
          >M</button>
          <button
            type="button"
            onClick={onSoloToggle}
            title={soloed ? 'Unsolo' : 'Solo'}
            style={{
              height: 22,
              padding: '0 7px',
              borderRadius: 4,
              border: soloed ? '1px solid rgba(255,109,63,0.65)' : '1px solid rgba(255,255,255,0.12)',
              color: soloed ? '#FF6D3F' : 'rgba(255,255,255,0.38)',
              background: soloed ? 'rgba(255,109,63,0.12)' : 'transparent',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'border-color 120ms, color 120ms, background 120ms',
            }}
          >S</button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume ?? 75}
            onChange={e => onVolumeChange(Number(e.target.value))}
            className="flex-1"
            style={{
              background: `linear-gradient(to right, #FF6D3F ${volume ?? 75}%, #1A1A2E ${volume ?? 75}%)`,
              opacity: muted ? 0.35 : 1,
              transition: 'opacity 120ms',
            }}
          />
          </div>
        </div>
      )}
      <div className="rounded-xl p-2" style={{ border: '1px solid var(--border-weak)', background: 'rgba(0,0,0,0.16)' }}>
        <PianoRoll notes={notes} color={color} />
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: 'rgba(255,255,255,0.30)',
          textAlign: 'center',
          marginTop: 8,
          letterSpacing: '0.06em',
        }}>
          drag into DAW
        </p>
      </div>

      {/* FX panel */}
      {fxOpen && (
        <div
          className="mt-3"
          style={{
            background: '#111118',
            border: '1px solid #1A1A2E',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Reverb */}
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', width: 42, flexShrink: 0 }}>
              Reverb
            </span>
            <input
              type="range" min={0} max={100} step={1}
              value={fxSettings.reverb}
              onChange={e => updateFX({ reverb: Number(e.target.value) })}
              style={{
                flex: 1,
                background: `linear-gradient(to right, #FF6D3F ${fxSettings.reverb}%, #1A1A2E ${fxSettings.reverb}%)`,
              }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', width: 24, textAlign: 'right', flexShrink: 0 }}>
              {fxSettings.reverb}
            </span>
          </div>
          {/* Delay */}
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', width: 42, flexShrink: 0 }}>
              Delay
            </span>
            <input
              type="range" min={0} max={100} step={1}
              value={fxSettings.delay}
              onChange={e => updateFX({ delay: Number(e.target.value) })}
              style={{
                flex: 1,
                background: `linear-gradient(to right, #FF6D3F ${fxSettings.delay}%, #1A1A2E ${fxSettings.delay}%)`,
              }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', width: 24, textAlign: 'right', flexShrink: 0 }}>
              {fxSettings.delay}
            </span>
          </div>
          {/* Filter */}
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', width: 42, flexShrink: 0 }}>
              Filter
            </span>
            <input
              type="range" min={200} max={20000} step={100}
              value={fxSettings.filter}
              onChange={e => updateFX({ filter: Number(e.target.value) })}
              style={{
                flex: 1,
                background: `linear-gradient(to right, #FF6D3F ${((fxSettings.filter - 200) / 19800) * 100}%, #1A1A2E ${((fxSettings.filter - 200) / 19800) * 100}%)`,
              }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', width: 32, textAlign: 'right', flexShrink: 0 }}>
              {fxSettings.filter >= 1000 ? `${Math.round(fxSettings.filter / 1000)}k` : fxSettings.filter}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── SKELETON CARD ────────────────────────────────────────────
function SkeletonCard({ name }: { name: string }) {
  return (
    <motion.div variants={fadeUp} className={`layer-card active-${name}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-2 h-2 rounded-full" />
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-14 rounded" />
            <div className="skeleton h-3 w-10 rounded" />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton w-8 h-8 rounded-lg" />
        </div>
      </div>
      <div className="skeleton w-full rounded-md" style={{ height: 88 }} />
    </motion.div>
  );
}

// ─── CHORD NAME DERIVATION ────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const INTERVAL_QUALITY: Record<string, string> = {
  '0,3,7': 'm',     '0,4,7': '',      '0,3,6': 'dim',  '0,4,8': 'aug',
  '0,3,7,10': 'm7', '0,4,7,11': 'M7', '0,4,7,10': '7', '0,3,6,10': 'm7b5',
  '0,3,7,11': 'mM7','0,2,7': 'sus2',  '0,5,7': 'sus4',
};

function pitchesToChordName(pitches: number[]): string {
  if (pitches.length === 0) return '—';
  const classes = [...new Set(pitches.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  if (classes.length === 1) return NOTE_NAMES[classes[0]!];
  for (const root of classes) {
    const intervals = classes.map(c => (c - root + 12) % 12).sort((a, b) => a - b);
    const key = intervals.join(',');
    if (key in INTERVAL_QUALITY) return NOTE_NAMES[root] + INTERVAL_QUALITY[key];
  }
  return NOTE_NAMES[classes[0]!]; // fallback: lowest note
}

function deriveChordProgression(chords: NoteEvent[], bars: number): string[] {
  return Array.from({ length: bars }, (_, bar) => {
    const barNotes = chords.filter(n => n.startTime >= bar * 4 && n.startTime < bar * 4 + 4);
    if (barNotes.length === 0) return '—';
    const firstOnset = Math.min(...barNotes.map(n => n.startTime));
    const onset = barNotes.filter(n => Math.abs(n.startTime - firstOnset) < 0.05);
    return pitchesToChordName(onset.map(n => n.pitch));
  });
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function midiToPitchXml(midi: number): { step: string; alter?: number; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  // Sharps only (simple + deterministic)
  const map: Array<{ step: string; alter?: number }> = [
    { step: 'C' },
    { step: 'C', alter: 1 },
    { step: 'D' },
    { step: 'D', alter: 1 },
    { step: 'E' },
    { step: 'F' },
    { step: 'F', alter: 1 },
    { step: 'G' },
    { step: 'G', alter: 1 },
    { step: 'A' },
    { step: 'A', alter: 1 },
    { step: 'B' },
  ];
  const base = map[pc]!;
  return { step: base.step, alter: base.alter, octave };
}

function beatsToDivisions(beats: number, divisionsPerQuarter: number): number {
  return Math.max(1, Math.round(beats * divisionsPerQuarter));
}

function toMusicXml({
  title,
  bpm,
  bars,
  parts,
}: {
  title: string;
  bpm: number;
  bars: number;
  parts: Array<{ id: string; name: string; notes: NoteEvent[] }>;
}): string {
  const divisions = 4; // quarter note = 4 divisions (16th = 1) matches 0.25 beat grid
  const beatsPerBar = 4;
  const barBeats = beatsPerBar;

  const partList = parts
    .map(p => (
      `    <score-part id="${escapeXml(p.id)}">\n` +
      `      <part-name>${escapeXml(p.name)}</part-name>\n` +
      `    </score-part>`
    ))
    .join('\n');

  const partXml = parts.map((p, partIdx) => {
    const measures: string[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barStart = bar * barBeats;
      const barEnd = barStart + barBeats;

      // Collect notes that start within this bar, quantized to 16ths (0.25 beat)
      const inBar = p.notes
        .filter(n => n.startTime >= barStart && n.startTime < barEnd && n.duration > 0)
        .map(n => ({
          ...n,
          startTime: Math.round(n.startTime * 4) / 4,
          duration: Math.round(n.duration * 4) / 4,
        }))
        .sort((a, b) => (a.startTime - b.startTime) || (a.pitch - b.pitch));

      // Group by startTime for basic chord handling
      const groups = new Map<number, NoteEvent[]>();
      for (const n of inBar) {
        const t = n.startTime;
        const arr = groups.get(t);
        if (arr) arr.push(n);
        else groups.set(t, [n]);
      }
      const times = [...groups.keys()].sort((a, b) => a - b);

      let cursor = barStart;
      const measureNotes: string[] = [];

      const pushRest = (restBeats: number) => {
        const dur = beatsToDivisions(restBeats, divisions);
        measureNotes.push(
          `      <note>\n` +
          `        <rest/>\n` +
          `        <duration>${dur}</duration>\n` +
          `      </note>`
        );
      };

      for (const t of times) {
        if (t > cursor) pushRest(t - cursor);

        const chordNotes = groups.get(t) ?? [];
        // Use the max duration among chord tones; MusicXML chord tones share the same duration
        const durBeats = Math.max(...chordNotes.map(n => n.duration));
        const dur = beatsToDivisions(durBeats, divisions);

        chordNotes.forEach((n, i) => {
          const { step, alter, octave } = midiToPitchXml(n.pitch);
          measureNotes.push(
            `      <note>\n` +
            (i > 0 ? `        <chord/>\n` : '') +
            `        <pitch>\n` +
            `          <step>${step}</step>\n` +
            (typeof alter === 'number' ? `          <alter>${alter}</alter>\n` : '') +
            `          <octave>${octave}</octave>\n` +
            `        </pitch>\n` +
            `        <duration>${dur}</duration>\n` +
            `      </note>`
          );
        });

        cursor = t + durBeats;
      }

      if (cursor < barEnd) pushRest(barEnd - cursor);

      const attrs =
        bar === 0
          ? (
            `      <attributes>\n` +
            `        <divisions>${divisions}</divisions>\n` +
            `        <key><fifths>0</fifths></key>\n` +
            `        <time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time>\n` +
            `        <clef>\n` +
            `          <sign>${partIdx === 3 ? 'percussion' : 'G'}</sign>\n` +
            `          <line>2</line>\n` +
            `        </clef>\n` +
            `      </attributes>\n` +
            `      <direction placement="above">\n` +
            `        <direction-type>\n` +
            `          <metronome>\n` +
            `            <beat-unit>quarter</beat-unit>\n` +
            `            <per-minute>${Math.round(bpm)}</per-minute>\n` +
            `          </metronome>\n` +
            `        </direction-type>\n` +
            `      </direction>\n`
          )
          : '';

      measures.push(
        `    <measure number="${bar + 1}">\n` +
        attrs +
        measureNotes.join('\n') +
        `\n    </measure>`
      );
    }

    return `  <part id="${escapeXml(p.id)}">\n${measures.join('\n')}\n  </part>`;
  }).join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="3.1">\n` +
    `  <work><work-title>${escapeXml(title)}</work-title></work>\n` +
    `  <part-list>\n${partList}\n  </part-list>\n` +
    `${partXml}\n` +
    `</score-partwise>\n`
  );
}

// ─── SHEET MUSIC (CANVAS) ──────────────────────────────────────
function midiToStaffY(pitch: number, staffTopY: number, lineGap: number): number {
  // Treble-ish mapping using semitone steps relative to E4 as the bottom line reference.
  // This is intentionally simple (no clef glyphs / accidentals rendering).
  const bottomLinePitch = 64; // E4
  const steps = (pitch - bottomLinePitch) / 1; // semitone steps
  // Map 2 semitones ≈ 1 staff step (line/space). This is a simplification.
  const staffSteps = steps / 2;
  const bottomLineY = staffTopY + lineGap * 4;
  return bottomLineY - staffSteps * (lineGap / 2);
}

function drawSheetMusic(
  canvas: HTMLCanvasElement,
  notes: NoteEvent[],
  params: GenerationParams,
  layer: string
) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 900;
  const height = canvas.clientHeight || 320;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = readCssColor('--piano-roll-bg', '#0A0A0B');
  ctx.fillRect(0, 0, width, height);

  const ink = readCssColor('--text', 'rgba(255,255,255,0.90)');
  const inkMuted = readCssColor('--muted', 'rgba(255,255,255,0.50)');
  const staffLine = readCssColor('--piano-roll-beat-bar', 'rgba(255,255,255,0.14)');
  const measureLine = readCssColor('--border', 'rgba(255,255,255,0.10)');
  const hollowFill = readCssColor('--piano-roll-bg', '#0A0A0B');

  // Header text
  ctx.fillStyle = ink;
  ctx.font = '700 14px "DM Sans", system-ui, sans-serif';
  ctx.fillText(`${layer.toUpperCase()} — Sheet Music`, 16, 26);
  ctx.fillStyle = inkMuted;
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`4/4  ·  Key: ${params.key} ${scaleLabel(params.scale)}  ·  ${params.bpm} BPM`, 16, 46);

  const staffTop = 86;
  const staffLeft = 16;
  const staffRight = width - 16;
  const lineGap = 12;

  // Staff (5 lines)
  ctx.strokeStyle = staffLine;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = staffTop + i * lineGap;
    ctx.beginPath();
    ctx.moveTo(staffLeft, y);
    ctx.lineTo(staffRight, y);
    ctx.stroke();
  }

  // Measure lines for total bars
  const bars = params.bars ?? 4;
  const beatsTotal = bars * 4;
  const usableW = staffRight - staffLeft - 60; // leave some margin
  const startX = staffLeft + 60;
  ctx.strokeStyle = measureLine;
  for (let b = 0; b <= bars; b++) {
    const x = startX + (b / bars) * usableW;
    ctx.beginPath();
    ctx.moveTo(x, staffTop);
    ctx.lineTo(x, staffTop + lineGap * 4);
    ctx.stroke();
  }

  // Notes
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  for (const n of sorted) {
    const t = Math.max(0, Math.min(beatsTotal, n.startTime));
    const x = startX + (t / beatsTotal) * usableW;
    const y = midiToStaffY(n.pitch, staffTop, lineGap);

    // Duration → notehead style (very basic)
    const dur = n.duration;
    const isWhole = dur >= 3.75;
    const isHalf = dur >= 1.75 && dur < 3.75;
    const filled = !(isWhole || isHalf);

    // Notehead
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = filled ? ink : hollowFill;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Stem (skip for whole notes)
    if (!isWhole) {
      const stemUp = y > staffTop + lineGap * 2; // simplistic
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(x + 7, y);
        ctx.lineTo(x + 7, y - 26);
      } else {
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x - 7, y + 26);
      }
      ctx.stroke();
    }
  }
}

// ─── AUDIO → MIDI (legacy FFT impl; kept for now) ────────────────────────────────────────
function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function hann(i: number, n: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
}

// In-place radix-2 FFT (real/imag arrays). Minimal + sufficient for dominant bin detection.
function fftRadix2(re: Float32Array, im: Float32Array) {
  const n = re.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wlenCos = Math.cos(ang);
    const wlenSin = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wCos = 1;
      let wSin = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k]!;
        const uIm = im[i + k]!;
        const vRe = re[i + k + len / 2]!;
        const vIm = im[i + k + len / 2]!;
        const tRe = vRe * wCos - vIm * wSin;
        const tIm = vRe * wSin + vIm * wCos;
        re[i + k] = uRe + tRe;
        im[i + k] = uIm + tIm;
        re[i + k + len / 2] = uRe - tRe;
        im[i + k + len / 2] = uIm - tIm;
        const nextCos = wCos * wlenCos - wSin * wlenSin;
        const nextSin = wCos * wlenSin + wSin * wlenCos;
        wCos = nextCos;
        wSin = nextSin;
      }
    }
  }
}

function detectNotesFromAudio(buffer: AudioBuffer, bpm: number): NoteEvent[] {
  const sr = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

  // Limit analysis length for UX
  const maxSeconds = Math.min(45, buffer.duration);
  const maxSamples = Math.min(ch0.length, Math.floor(sr * maxSeconds));

  const fftSize = 2048;
  const hop = 512;
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  type Frame = { tSec: number; midi: number | null; mag: number };
  const frames: Frame[] = [];

  const minHz = 55;
  const maxHz = 1760; // ~A6
  const minBin = Math.max(1, Math.floor((minHz * fftSize) / sr));
  const maxBin = Math.min(fftSize / 2 - 1, Math.floor((maxHz * fftSize) / sr));

  for (let pos = 0; pos + fftSize < maxSamples; pos += hop) {
    for (let i = 0; i < fftSize; i++) {
      const s0 = ch0[pos + i] ?? 0;
      const s1 = ch1 ? (ch1[pos + i] ?? 0) : 0;
      const s = ch1 ? (s0 + s1) * 0.5 : s0;
      re[i] = s * hann(i, fftSize);
      im[i] = 0;
    }

    fftRadix2(re, im);

    let bestBin = -1;
    let bestMag = 0;
    for (let b = minBin; b <= maxBin; b++) {
      const mag = re[b]! * re[b]! + im[b]! * im[b]!;
      if (mag > bestMag) { bestMag = mag; bestBin = b; }
    }

    const tSec = pos / sr;
    const mag = Math.sqrt(bestMag);
    if (bestBin < 0) {
      frames.push({ tSec, midi: null, mag: 0 });
      continue;
    }

    const freq = (bestBin * sr) / fftSize;
    const midi = freqToMidi(freq);
    frames.push({ tSec, midi, mag });
  }

  if (frames.length === 0) return [];

  const mags = frames.map(f => f.mag).sort((a, b) => a - b);
  const p70 = mags[Math.floor(mags.length * 0.7)] ?? 0;
  const p90 = mags[Math.floor(mags.length * 0.9)] ?? p70;
  const threshold = p70 + (p90 - p70) * 0.25;

  const secondsPerBeat = 60 / Math.max(60, Math.min(200, bpm));

  let curMidi: number | null = null;
  let curStartSec = 0;
  let curLastSec = 0;
  let curVel = 90;

  const notes: NoteEvent[] = [];
  const commit = () => {
    if (curMidi === null) return;
    const durSec = Math.max(0.08, curLastSec - curStartSec);
    notes.push({
      pitch: Math.max(24, Math.min(108, curMidi)),
      startTime: curStartSec / secondsPerBeat,
      duration: Math.max(0.125, durSec / secondsPerBeat),
      velocity: Math.max(45, Math.min(120, curVel)),
    });
  };

  for (const f of frames) {
    const active = f.mag >= threshold && f.midi !== null;
    const midi = active ? f.midi : null;

    if (curMidi === null) {
      if (midi !== null) {
        curMidi = midi;
        curStartSec = f.tSec;
        curLastSec = f.tSec;
        curVel = Math.round(70 + Math.min(50, (f.mag / Math.max(1e-6, p90)) * 50));
      }
      continue;
    }

    if (midi === null) {
      commit();
      curMidi = null;
      continue;
    }

    if (Math.abs(midi - curMidi) <= 1) {
      curLastSec = f.tSec;
      curVel = Math.max(curVel, Math.round(70 + Math.min(50, (f.mag / Math.max(1e-6, p90)) * 50)));
    } else {
      commit();
      curMidi = midi;
      curStartSec = f.tSec;
      curLastSec = f.tSec;
      curVel = Math.round(70 + Math.min(50, (f.mag / Math.max(1e-6, p90)) * 50));
    }
  }
  commit();

  // Merge very short notes into neighbors
  const merged: NoteEvent[] = [];
  for (const n of notes) {
    const prev = merged.at(-1);
    if (prev && n.duration <= 0.15 && Math.abs(n.pitch - prev.pitch) <= 1) {
      prev.duration = Math.max(prev.duration, (n.startTime + n.duration) - prev.startTime);
      prev.velocity = Math.max(prev.velocity, n.velocity);
    } else {
      merged.push({ ...n });
    }
  }

  return merged;
}

function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

function detectKeyScaleFromSeed(seed: NoteEvent[]): { key: typeof KEYS[number]; scale: string } {
  const pcs = seed.map(n => midiToPitchClass(n.pitch));
  const pcSet = new Set(pcs);
  if (pcSet.size === 0) return { key: 'A', scale: 'minor' };

  const candidates = MANUAL_SCALE_OPTIONS.map(s => s.value);
  let bestKey: typeof KEYS[number] = 'A';
  let bestScale = 'minor';
  let bestScore = -Infinity;

  for (const key of KEYS) {
    const rootPc = (KEYS as readonly string[]).indexOf(key);
    for (const scale of candidates) {
      const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.minor;
      const allowed = new Set(intervals.map(i => (rootPc + i) % 12));
      let inScale = 0;
      for (const pc of pcSet) if (allowed.has(pc)) inScale++;
      const out = pcSet.size - inScale;
      const score = inScale * 2 - out * 3;
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
        bestScale = scale;
      }
    }
  }
  return { key: bestKey, scale: bestScale };
}

function detectDirectionBias(seed: NoteEvent[]): number {
  const sorted = [...seed].sort((a, b) => a.startTime - b.startTime);
  if (sorted.length < 2) return 0;
  const first = sorted[0]!.pitch;
  const last = sorted.at(-1)!.pitch;
  return Math.max(-1, Math.min(1, (last - first) / 24));
}

function quantizeDurations(seed: NoteEvent[]): number[] {
  const q = (v: number) => {
    const step = 0.25; // 1/16 in 4/4 (1 beat = quarter)
    const snapped = Math.round(v / step) * step;
    return Math.max(step, Math.min(4, snapped));
  };
  const out = seed
    .map(n => q(n.duration))
    .filter(d => d >= 0.25 && d <= 4);
  return out.length > 0 ? out : [0.25, 0.5, 1];
}

// ─── VARIATION CARD ───────────────────────────────────────────
function VariationCard({
  label, result: vResult, variationParams, selected, isPlaying,
  onSelect, onPlayToggle, onDownload, onExtend,
  compareHighlight, isPublic, onTogglePublic,
}: {
  label: string;
  result: GenerationResult;
  variationParams: GenerationParams;
  selected: boolean;
  isPlaying: boolean;
  compareHighlight?: boolean;
  isPublic?: boolean;
  onSelect: () => void;
  onPlayToggle: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onExtend?: (e: React.MouseEvent) => void;
  onTogglePublic?: (e: React.MouseEvent) => void;
}) {
  const layerCounts = LAYERS.map(layer => ({ layer, count: vResult[layer].length }));
  const totalNotes = layerCounts.reduce((sum, item) => sum + item.count, 0);
  const activeLayers = layerCounts.filter(item => item.count > 0).length;
  const chordProgression = deriveChordProgression(vResult.chords, variationParams.bars);
  const maxLayerNotes = Math.max(1, ...layerCounts.map(item => item.count));

  return (
    <motion.div
      variants={fadeUp}
      className="variation-card glass-elevated card-tilt-hover"
      onClick={onSelect}
      animate={compareHighlight ? { borderColor: ['rgba(255,109,63,0.35)', 'rgba(255,109,63,0.85)', 'rgba(255,109,63,0.35)'] } : false}
      transition={compareHighlight ? { duration: 1.1, repeat: Infinity, ease: EASE_UI } : { duration: 0.3, ease: EASE_UI }}
      style={{
        border: compareHighlight ? '2px solid rgba(255,109,63,0.55)' : (selected ? `1.5px solid ${DS.accent}` : '1px solid var(--border)'),
        cursor: 'pointer',
        background: selected ? 'linear-gradient(180deg, rgba(255,109,63,0.10), var(--surface-strong) 42%)' : 'var(--surface)',
        transition: 'border-color 300ms cubic-bezier(0.23, 1, 0.32, 1), background 300ms cubic-bezier(0.23, 1, 0.32, 1)',
        flex: 1,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', color: selected ? DS.accent : 'var(--muted)' }}>
              TAKE {label}
            </span>
            {selected && (
              <span className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(255,109,63,0.14)', border: '1px solid rgba(255,109,63,0.32)', color: DS.accent, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
                ACTIVE
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="variation-stat">{activeLayers}/4 layers</span>
            <span className="variation-stat">{totalNotes} events</span>
            <span className="variation-stat">{variationParams.key} {variationParams.scale}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onTogglePublic && (
            <button
              onClick={onTogglePublic}
              className="w-5 h-5 flex items-center justify-center rounded transition-colors"
              style={{
                color: isPublic ? '#00B894' : 'rgba(255,255,255,0.30)',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              title={isPublic ? 'Make private' : 'Make public'}
              aria-label="Toggle visibility"
            >
              {isPublic ? '◎' : '○'}
            </button>
          )}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
            {variationParams.bpm} BPM
          </span>
        </div>
      </div>
      <PianoRoll notes={vResult.melody} color={DS.accent} height={56} />
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {layerCounts.map(({ layer, count }) => (
          <div key={layer} className="rounded-md px-1.5 py-1" style={{ border: '1px solid var(--border-weak)', background: 'rgba(255,255,255,0.025)' }}>
            <div className="mb-1 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                style={{
                  width: `${Math.max(8, Math.round((count / maxLayerNotes) * 100))}%`,
                  height: '100%',
                  background: LAYER_COLORS[layer],
                  opacity: count > 0 ? 0.9 : 0.25,
                }}
              />
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8.5, color: count > 0 ? LAYER_COLORS[layer] : 'var(--muted)' }}>
              {layer.slice(0, 3).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div className="variation-chords flex gap-1.5 flex-wrap mt-3 mb-1">
        {chordProgression.map((name, i, arr) => (
          <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {name}
            {i < arr.length - 1 && <span style={{ color: 'rgba(255,255,255,0.30)' }}>→</span>}
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={onPlayToggle}
          className="flex-1 h-8 flex items-center justify-center rounded-lg text-xs transition-all tip"
          data-tip={isPlaying ? 'Stop preview' : 'Preview'}
          style={{ border: isPlaying ? '1px solid rgba(255,109,63,0.55)' : '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: isPlaying ? DS.accent : 'var(--text)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          onClick={onDownload}
          disabled={!selected}
          className="flex-1 h-8 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30 tip"
          data-tip={selected ? 'Download all tracks' : 'Select to download'}
          style={{ border: selected ? '1px solid rgba(0,184,148,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { if (selected) e.currentTarget.style.borderColor = 'rgba(0,184,148,0.7)'; }}
          onMouseLeave={e => { if (selected) e.currentTarget.style.borderColor = 'rgba(0,184,148,0.4)'; }}
        >
          Download
        </button>
      </div>
      {selected && (
        <>
          <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
            {(['melody', 'chords', 'bass', 'drums'] as const).map(layer => {
              const notes = vResult[layer];
              const genreName = GENRES[variationParams.genre]?.name || 'track';
              return (
                <button
                  key={layer}
                  disabled={notes.length === 0}
                  onClick={e => {
                    e.stopPropagation();
                    track('midi_downloaded', { genre: variationParams.genre, layer });
                    const midi = generateMidiFormat0(notes, variationParams.bpm, `pulp-${layer}`);
                    downloadMidi(midi, `pulp-${layer}-${genreName.toLowerCase().replace(/\s/g, '-')}-${variationParams.key}${variationParams.scale}.mid`);
                  }}
                  className="flex-1 h-7 flex items-center justify-center rounded-md transition-all disabled:opacity-30"
                  style={{
                    border: '1px solid var(--border-weak)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: LAYER_COLORS[layer],
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  title={`Download ${layer}`}
                >
                  {layer.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onExtend?.(e); }}
            className="w-full h-8 mt-2 flex items-center justify-center rounded-lg text-xs transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
            title="Extend this variation by 8 bars"
          >
            + Extend 8 bars
          </button>
        </>
      )}
    </motion.div>
  );
}

// ─── COMMAND BAR ──────────────────────────────────────────────
function CommandBar({
  isOpen,
  onClose,
  onGenerate,
  onFocusPrompt,
  onToggleLayers,
  onDownloadAll,
  onOpenBlog,
  onOpenInspire,
  onGoToPricing,
  hasResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onFocusPrompt: () => void;
  onToggleLayers: () => void;
  onDownloadAll: () => void;
  onOpenBlog: () => void;
  onOpenInspire: () => void;
  onGoToPricing: () => void;
  hasResult: boolean;
}) {
  const [search, setSearch] = useState('');

  const actions = [
    { icon: '♪', label: 'Generate track', hint: 'G', action: onGenerate, enabled: true },
    { icon: '↵', label: 'Focus prompt', hint: '↵', action: onFocusPrompt, enabled: true },
    { icon: '⊙', label: 'Toggle all layers', hint: 'L', action: onToggleLayers, enabled: true },
    { icon: '↓', label: 'Download last MIDI', hint: '⌘S', action: onDownloadAll, enabled: hasResult },
    { icon: '↗', label: 'Open blog', hint: 'B', action: onOpenBlog, enabled: true },
    { icon: '✦', label: 'Open inspire', hint: 'I', action: onOpenInspire, enabled: true },
    { icon: '$', label: 'Go to pricing', hint: 'P', action: onGoToPricing, enabled: true },
    { icon: '⟳', label: 'Regenerate', hint: 'R', action: onGenerate, enabled: true },
  ];

  const filteredActions = actions.filter(a => a.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
            <motion.div
              className="w-full max-w-[480px] pointer-events-auto"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: EASE_UI }}
            >
              <div className="cmd-modal">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                    Quick actions
                  </span>
                  <kbd>ESC</kbd>
                </div>

                <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search actions..."
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="p-2">
                  {filteredActions.map(a => (
                    <button
                      key={a.label}
                      className="cmd-action"
                      disabled={!a.enabled}
                      onClick={() => { a.action(); onClose(); }}
                    >
                      <span className="flex items-center gap-3">
                        <span style={{ color: 'var(--accent)', fontSize: 14, width: 16, textAlign: 'center' }}>{a.icon}</span>
                        <span style={{ fontSize: 14 }}>{a.label}</span>
                      </span>
                      <kbd>{a.hint}</kbd>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-center gap-2"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  <kbd>⌘K</kbd>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    to open · <kbd style={{ fontSize: 10 }}>ESC</kbd> to close
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

const SHORTCUT_OVERLAY_GROUPS: { title: string; rows: { k: string; d: string }[] }[] = [
  {
    title: 'Global',
    rows: [
      { k: '?', d: 'Show keyboard shortcuts' },
      { k: 'Esc', d: 'Close modal, overlay, or fullscreen' },
      { k: '⌘ / Ctrl + K', d: 'Open command bar' },
    ],
  },
  {
    title: 'Generator',
    rows: [
      { k: 'G', d: 'New generation' },
      { k: 'R', d: 'Regenerate current variation' },
      { k: 'I', d: 'Toggle Inspire mode' },
      { k: 'S', d: 'Share link' },
      { k: 'C', d: 'Toggle Compare mode' },
      { k: '1 / 2 / 3', d: 'Select variation' },
      { k: 'Space', d: 'Play / pause current variation' },
      { k: 'B', d: 'Open blog' },
      { k: 'P', d: 'Go to pricing' },
      { k: '⌘ / Ctrl + S', d: 'Export MIDI (full arrangement)' },
      { k: '⌘ / Ctrl + Shift + S', d: 'Export WAV' },
    ],
  },
  {
    title: 'Piano Roll',
    rows: [
      { k: 'E', d: 'Toggle piano roll / sheet view' },
      { k: 'F', d: 'Fullscreen piano roll' },
      { k: 'D', d: 'Toggle chord detection overlay' },
      { k: '⌘ / Ctrl + E', d: 'Extend variation (+8 bars)' },
      { k: 'Del / Backspace', d: 'Delete selected notes' },
      { k: '⌘ / Ctrl + A', d: 'Select all notes' },
      { k: '⌘ / Ctrl + Z', d: 'Undo' },
      { k: '⌘ / Ctrl + Shift + Z', d: 'Redo' },
      { k: '← → ↑ ↓', d: 'Nudge selected notes (time / pitch)' },
      { k: '⌘ / Ctrl + Scroll', d: 'Zoom in / out' },
    ],
  },
];

// ─── HISTORY SIDEBAR ──────────────────────────────────────────
function HistorySidebar({
  history, loading, onRestore, onClose, isSignedIn, userId, supabase,
}: {
  history: HistoryEntry[];
  loading: boolean;
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
  isSignedIn: boolean;
  userId: string | null;
  supabase: any;
}) {
  const [query, setQuery] = React.useState('');
  const [tab, setTab] = React.useState<'all' | 'favorites'>('all');
  const [genreFilter, setGenreFilter] = React.useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [rows, setRows] = React.useState<Array<{
    id: string;
    prompt: string;
    genre: string;
    bpm: number;
    created_at: string;
    layers: GenerationResult;
    inspiration_source: string | null;
    is_favorite: boolean;
    is_public: boolean;
    tags: string[] | null;
  }>>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [fetching, setFetching] = React.useState(false);
  const [dbError, setDbError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

  // Single effect: resets state and fetches page 0 whenever filter/auth changes.
  // This avoids the race condition where a stale `page` value from a previous
  // load is captured by the loadMore callback before the reset state takes effect.
  React.useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;
    setRows([]);
    setPage(1);
    setHasMore(true);
    setDbError(null);
    setFetching(true);
    const run = async () => {
      try {
        let q = supabase
          .from('generations')
          .select('id, prompt, genre, bpm, layers, created_at, inspiration_source, is_favorite, is_public, tags')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (tab === 'favorites') q = q.eq('is_favorite', true);
        if (genreFilter) q = q.eq('genre', genreFilter);
        const { data, error } = await q.range(0, PAGE_SIZE - 1);
        if (cancelled) return;
        if (error) { setDbError(error.message); return; }
        const next = (data ?? []) as any[];
        setRows(next);
        if (next.length < PAGE_SIZE) setHasMore(false);
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [isSignedIn, userId, tab, genreFilter, supabase, retryKey]);

  // Loads subsequent pages on infinite scroll. `page` is 1 after the initial load.
  const loadMore = React.useCallback(async () => {
    if (!isSignedIn || !userId) return;
    if (fetching || !hasMore) return;
    setFetching(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('generations')
        .select('id, prompt, genre, bpm, layers, created_at, inspiration_source, is_favorite, tags')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (tab === 'favorites') q = q.eq('is_favorite', true);
      if (genreFilter) q = q.eq('genre', genreFilter);
      const { data, error } = await q.range(from, to);
      if (error) { setDbError(error.message); return; }
      const next = (data ?? []) as any[];
      setRows(prev => [...prev, ...next]);
      setPage(p => p + 1);
      if (next.length < PAGE_SIZE) setHasMore(false);
    } finally {
      setFetching(false);
    }
  }, [isSignedIn, userId, supabase, tab, genreFilter, fetching, hasMore, page]);

  const displayed = React.useMemo(() => {
    const ql = query.trim().toLowerCase();
    const base = rows;
    if (!ql) return base;
    return base.filter(r => {
      const genreName = (GENRES[r.genre]?.name || r.genre || '').toLowerCase();
      const insp = (r.inspiration_source || '').toLowerCase();
      const key = guessKeyFromLayers(r.layers).toLowerCase();
      const bpm = String(r.bpm);
      return (
        genreName.includes(ql) ||
        (r.genre || '').toLowerCase().includes(ql) ||
        insp.includes(ql) ||
        key.includes(ql) ||
        bpm.includes(ql)
      );
    });
  }, [rows, query]);

  const availableGenres = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.genre) set.add(r.genre);
    return [...set].sort((a, b) => (GENRES[a]?.name || a).localeCompare(GENRES[b]?.name || b));
  }, [rows]);

  // Group rows that share the same prompt + same minute into one history entry.
  const groupedDisplayed = React.useMemo(() => {
    const map = new Map<string, typeof displayed>();
    for (const row of displayed) {
      const key = `${row.prompt || row.id}|${row.created_at.slice(0, 16)}`;
      const g = map.get(key) ?? [];
      g.push(row);
      map.set(key, g);
    }
    return [...map.values()];
  }, [displayed]);

  const toggleFavorite = React.useCallback(async (id: string, next: boolean) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, is_favorite: next } : r)));
    try {
      await supabase.from('generations').update({ is_favorite: next }).eq('id', id);
    } catch {
      // revert on failure
      setRows(prev => prev.map(r => (r.id === id ? { ...r, is_favorite: !next } : r)));
    }
  }, [supabase]);

  const togglePublic = React.useCallback(async (id: string, next: boolean) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, is_public: next } : r)));
    try {
      await supabase.from('generations').update({ is_public: next }).eq('id', id).eq('user_id', userId!);
    } catch {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, is_public: !next } : r)));
    }
  }, [supabase, userId]);

  return (
    <motion.div
      className="fixed right-0 top-0 h-full w-full sm:w-80 z-40 flex flex-col glass-elevated"
      style={{ borderLeft: '1px solid var(--border)' }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%', transition: { duration: 0.26, ease: EASE_EXIT } }}
      transition={{ duration: 0.3, ease: EASE_UI }}
    >
      <div className="flex items-center justify-between px-6 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
          History
          {!fetching && rows.length > 0 && (
            <span className="ml-2 text-xs font-normal"
              style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              ({rows.length})
            </span>
          )}
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none transition-colors"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >×</button>
      </div>

      {(loading || (fetching && rows.length === 0 && !dbError)) ? (
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-full px-6 py-4"
              style={{ borderBottom: '1px solid rgba(26,26,46,0.5)' }}
            >
              <SkeletonText lines={2} gap={8} lastLineWidth="85%" />
              <div className="flex gap-2 mt-3">
                <Skeleton style={{ height: 14, width: 88, borderRadius: 4 }} />
                <Skeleton style={{ height: 14, width: 64, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : !isSignedIn ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
          <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--muted)' }}>
            Sign in to view your generation history.
          </p>
          <a
            href="/sign-in"
            className="btn-primary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            Sign in
          </a>
        </div>
      ) : dbError ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
          <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--muted)', fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif' }}>
            Couldn't load history — try refreshing
          </p>
          <p className="text-xs text-center font-mono break-all" style={{ color: 'rgba(255,255,255,0.30)', maxWidth: 240 }}>
            {dbError}
          </p>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setRetryKey(k => k + 1)}
          >
            Retry
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          {rows.length === 0 && tab === 'all' ? (
            <EmptyState
              title="No generations yet. Create your first one above."
            />
          ) : rows.length === 0 && tab === 'favorites' ? (
            <EmptyState
              title="No favorites yet"
              subtitle="Star a generation to save it here"
            />
          ) : query.trim().length > 0 ? (
            <EmptyState
              title={`No results for “${query.trim()}”`}
              subtitle="Try a different search term"
            />
          ) : (
            <EmptyState title="No results" subtitle="Try a different search term" />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" ref={listRef}
          onScroll={() => {
            const el = listRef.current;
            if (!el) return;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 280) void loadMore();
          }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(26,26,46,0.5)' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search genre, artist, key, BPM…"
              className="input-field w-full"
              style={{ height: 40, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(['all', 'favorites'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className="shrink-0 px-2.5 h-7 rounded-md text-[10px] font-mono border transition-colors"
                  style={{
                    borderColor: tab === t ? 'rgba(255,109,63,0.45)' : 'rgba(255,255,255,0.10)',
                    color: tab === t ? 'var(--accent)' : 'var(--muted)',
                    background: tab === t ? 'rgba(255,109,63,0.10)' : 'transparent',
                  }}
                  onClick={() => setTab(t)}
                >
                  {t === 'all' ? 'All' : 'Favorites'}
                </button>
              ))}
            </div>
            {availableGenres.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  className="shrink-0 px-2.5 h-7 rounded-md text-[10px] font-mono border transition-colors"
                  style={{
                    borderColor: !genreFilter ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
                    color: !genreFilter ? 'var(--text)' : 'var(--muted)',
                    background: !genreFilter ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                  onClick={() => setGenreFilter(null)}
                >
                  Any genre
                </button>
                {availableGenres.slice(0, 10).map(g => (
                  <button
                    key={g}
                    type="button"
                    className="shrink-0 px-2.5 h-7 rounded-md text-[10px] font-mono border transition-colors"
                    style={{
                      borderColor: genreFilter === g ? 'rgba(0,184,148,0.45)' : 'rgba(255,255,255,0.10)',
                      color: genreFilter === g ? DS.accent : 'var(--muted)',
                      background: genreFilter === g ? 'rgba(0,184,148,0.10)' : 'transparent',
                    }}
                    onClick={() => setGenreFilter(g)}
                    title={GENRES[g]?.name || g}
                  >
                    {(GENRES[g]?.name || g).slice(0, 14)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {groupedDisplayed.map(group => {
            const primary = group[0]!;
            const ts = new Date(primary.created_at);
            const keyGuess = guessKeyFromLayers(primary.layers);
            const genreName = GENRES[primary.genre]?.name || primary.genre;
            const rawPrompt = (primary.prompt || '').trim();
            const displayPrompt = rawPrompt
              ? (rawPrompt.length > 60 ? rawPrompt.slice(0, 60) + '…' : rawPrompt)
              : genreName;
            const groupKey = `${primary.prompt || primary.id}|${primary.created_at.slice(0, 16)}`;
            const isExpanded = expandedGroups.has(groupKey);

            const makeEntry = (row: typeof primary): HistoryEntry => {
              const kg = guessKeyFromLayers(row.layers);
              return {
                id: row.id,
                prompt: row.prompt,
                genre: row.genre,
                key: kg === '—' ? 'C' : kg,
                scale: 'minor',
                bpm: row.bpm,
                bars: 4,
                result: row.layers,
                params: { ...getDefaultParams(), genre: row.genre, bpm: row.bpm },
                timestamp: new Date(row.created_at),
              };
            };

            const renderVariationCard = (row: typeof primary, label: string, isMuted: boolean) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onRestore(makeEntry(row))}
                className="w-full text-left px-4 py-3 mx-3 max-w-[calc(100%-24px)] history-gen-card"
                style={{ background: isMuted ? 'rgba(255,255,255,0.02)' : undefined, marginBottom: isMuted ? 2 : 0 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = isMuted ? 'rgba(255,255,255,0.02)' : '')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs"
                      style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.25)' }}>
                      {GENRES[row.genre]?.name || row.genre} · {row.bpm} BPM · {guessKeyFromLayers(row.layers)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); void togglePublic(row.id, !row.is_public); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center border transition-colors"
                      style={{
                        borderColor: row.is_public ? 'rgba(0,184,148,0.45)' : 'rgba(255,255,255,0.08)',
                        background: row.is_public ? 'rgba(0,184,148,0.10)' : 'transparent',
                        color: row.is_public ? '#00B894' : 'rgba(255,255,255,0.35)',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      title={row.is_public ? 'Make private' : 'Make public'}
                      aria-label="Toggle visibility"
                    >
                      {row.is_public ? '◎' : '○'}
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); void toggleFavorite(row.id, !row.is_favorite); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center border transition-colors"
                      style={{
                        borderColor: row.is_favorite ? 'rgba(255,109,63,0.45)' : 'rgba(255,255,255,0.08)',
                        background: row.is_favorite ? 'rgba(255,109,63,0.10)' : 'transparent',
                        color: row.is_favorite ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
                        cursor: 'pointer',
                      }}
                      title={row.is_favorite ? 'Unfavorite' : 'Favorite'}
                      aria-label="Toggle favorite"
                    >
                      {row.is_favorite ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              </button>
            );

            return (
              <div key={groupKey} className="mb-2">
                {/* Primary card */}
                <button
                  type="button"
                  onClick={() => onRestore(makeEntry(primary))}
                  className="w-full text-left px-4 py-4 mx-3 max-w-[calc(100%-24px)] history-gen-card card-tilt-hover"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Line 1: prompt */}
                      <p
                        style={{
                          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.88)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.4,
                        }}
                      >
                        {displayPrompt}
                      </p>
                      {/* Line 2: genre · BPM · key */}
                      <p
                        className="mt-1"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.4 }}
                      >
                        {genreName} · {primary.bpm} BPM · {keyGuess}
                      </p>
                      {/* Line 3: relative date */}
                      <p
                        className="mt-0.5"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}
                      >
                        {formatTimeAgo(ts)}
                      </p>
                      {/* Auto tags */}
                      {primary.tags && primary.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {primary.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 9,
                                color: '#8A8A9A',
                                background: '#1A1A2E',
                                border: '1px solid #1A1A2E',
                                borderRadius: 4,
                                padding: '1px 5px',
                                lineHeight: 1.6,
                              }}
                            >{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* Variations pill */}
                      {group.length > 1 && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedGroups(prev => {
                              const next = new Set(prev);
                              next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
                              return next;
                            });
                          }}
                          className="mt-2 inline-flex items-center gap-1"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.45)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: 20,
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          {isExpanded ? '▴ hide' : `▾ ${group.length} variations`}
                        </button>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0" style={{ marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); void togglePublic(primary.id, !primary.is_public); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border transition-colors"
                        style={{
                          borderColor: primary.is_public ? 'rgba(0,184,148,0.45)' : 'rgba(255,255,255,0.10)',
                          background: primary.is_public ? 'rgba(0,184,148,0.10)' : 'transparent',
                          color: primary.is_public ? '#00B894' : 'rgba(255,255,255,0.50)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                        title={primary.is_public ? 'Make private' : 'Make public'}
                        aria-label="Toggle visibility"
                      >
                        {primary.is_public ? '◎' : '○'}
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); void toggleFavorite(primary.id, !primary.is_favorite); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border transition-colors"
                        style={{
                          borderColor: primary.is_favorite ? 'rgba(255,109,63,0.45)' : 'rgba(255,255,255,0.10)',
                          background: primary.is_favorite ? 'rgba(255,109,63,0.10)' : 'transparent',
                          color: primary.is_favorite ? 'var(--accent)' : 'rgba(255,255,255,0.50)',
                          cursor: 'pointer',
                        }}
                        title={primary.is_favorite ? 'Unfavorite' : 'Favorite'}
                        aria-label="Toggle favorite"
                      >
                        {primary.is_favorite ? '★' : '☆'}
                      </button>
                    </div>
                  </div>
                </button>

                {/* Expanded variations */}
                {isExpanded && group.slice(1).map((v, vi) =>
                  renderVariationCard(v, `Variation ${vi + 2}`, true)
                )}
              </div>
            );
          })}

          {fetching && (
            <div className="px-6 py-4">
              <SkeletonText lines={2} gap={8} lastLineWidth="75%" />
            </div>
          )}
        </div>
      )}

      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs text-center"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.35)' }}>
          Showing {displayed.length} · {tab === 'favorites' ? 'favorites' : 'latest'} · loads 20 at a time
        </p>
      </div>
    </motion.div>
  );
}

// ─── UPGRADE MODAL ────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'rgba(10,10,11,0.72)' }} onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: EASE_UI }}
      >
        <div className="text-3xl mb-4" style={{ color: 'var(--accent)' }}>✦</div>
        <h2 className="font-extrabold text-xl mb-3" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          You&apos;ve reached your monthly<br />generation limit.
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Upgrade to Pro for a higher monthly allowance.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/pricing"
            className="btn-primary w-full text-center py-3 rounded-xl font-semibold text-sm"
            style={{ display: 'block', textDecoration: 'none' }}
          >
            Upgrade to Pro
          </a>
          <button
            onClick={onClose}
            className="text-sm transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── GENRE NAME MAP (Claude AI → music-engine key) ────────────
const GENRE_NAME_MAP: Record<string, string> = {
  'Deep House': 'deep_house',
  'Melodic House': 'melodic_house',
  'Tech House': 'tech_house',
  'Minimal Tech': 'minimal_tech',
  'Techno': 'techno',
  'Melodic Techno': 'melodic_techno',
  'Hard Techno': 'hard_techno',
  'Progressive House': 'progressive_house',
  'Afro House': 'afro_house',
  'Organic House': 'afro_house',
  'Trance': 'trance',
  'UK Garage': 'house',
  'Drum & Bass': 'drum_and_bass',
  'Amapiano': 'afro_house',
  'Lo-Fi Hip-Hop': 'hiphop',
  'Hip-Hop': 'hiphop',
  'Trap': 'hiphop',
  'Pop': 'house',
  'R&B': 'rnb',
  'Disco/Nu-Disco': 'disco_nu_disco',
};

const VALID_SCALES = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'harmonic_minor',
  'pentatonic_minor', 'pentatonic_major', 'blues', 'melodic_minor'];

// ─── CONSTANTS ────────────────────────────────────────────────
const HIDDEN_GENRES = ['melodic_techno'];
const GENRE_LIST = Object.entries(GENRES)
  .filter(([key]) => !HIDDEN_GENRES.includes(key))
  .map(([key, g]) => ({ key, name: g.name }));

const VIBES = [
  { label: 'Dark',       tag: 'Dark Hypnotic Dub',      color: 'var(--muted)' },
  { label: 'Euphoric',   tag: 'Euphoric Melodic',        color: DS.accent },
  { label: 'Groovy',     tag: 'Organic Afro Groove',     color: 'rgba(255,255,255,0.65)' },
  { label: 'Aggressive', tag: 'Peak-Time Industrial',    color: 'rgba(255,255,255,0.45)' },
  { label: 'Dreamy',     tag: 'Ethereal Melodic',        color: 'rgba(255,255,255,0.55)' },
  { label: 'Funky',      tag: 'Nu-Disco Funk',           color: 'rgba(255,255,255,0.40)' },
  { label: 'Minimal',    tag: 'Quirky Minimal',          color: 'rgba(255,255,255,0.35)' },
  { label: 'Festival',   tag: 'Pumping Festival Tech',   color: DS.accent },
]
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function scaleLabel(value: string): string {
  const row = MANUAL_SCALE_OPTIONS.find(o => o.value === value);
  if (row) return row.label;
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeScaleToEngine(value: string): string {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (lower === 'harmonic minor') return 'harmonic_minor';
  if (lower === 'major') return 'major';
  if (lower === 'minor') return 'minor';
  if (lower === 'dorian') return 'dorian';
  if (lower === 'phrygian') return 'phrygian';
  if (lower === 'lydian') return 'lydian';
  if (lower === 'mixolydian') return 'mixolydian';
  const asKey = lower.replace(/\s/g, '_');
  if (VALID_SCALES.includes(asKey)) return asKey;
  return 'minor';
}

function HeroDemoPreview() {
  const [tick, setTick] = React.useState(0)
  const [playhead, setPlayhead] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => (t + 1) % 60)
      setPlayhead(t => (t + 1) % 100)
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const layers = [
    { name: 'Melody', color: LAYER_VIZ_COLORS.melody, pattern: [1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1] },
    { name: 'Chords', color: LAYER_VIZ_COLORS.chords, pattern: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
    { name: 'Bass',   color: LAYER_VIZ_COLORS.bass, pattern: [1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1] },
    { name: 'Drums',  color: LAYER_VIZ_COLORS.drums, pattern: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
  ]

  return (
    <div className="relative mb-6" style={{ position: 'relative' }}>
      {/* Ambient glow behind */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          zIndex: -1,
          inset: -20,
          background: 'radial-gradient(ellipse, rgba(255,109,63,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: DS.accent,
              }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>
              LIVE PREVIEW · Tech House · 128 BPM · Am
            </span>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            generate yours →
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {layers.map(layer => (
            <div
              key={layer.name}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-weak)', height: 52 }}
            >
              <div className="flex items-center gap-1.5 px-2 pt-1.5">
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: layer.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: layer.color, opacity: 0.7 }}>
                  {layer.name.toUpperCase()}
                </span>
              </div>
              <div className="flex items-end gap-px px-2 pb-2" style={{ height: 32, position: 'relative' }}>
                {layer.pattern.map((on, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 3,
                      background: layer.color,
                      opacity: on ? (i === tick % 16 ? 1 : 0.45) : 0.08,
                      height: on ? (layer.name === 'Melody' ? `${50 + Math.sin(i * 0.8) * 35}%` : layer.name === 'Drums' ? '80%' : '55%') : '15%',
                      transition: 'opacity 0.1s',
                      boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : undefined,
                    }}
                  />
                ))}
                {/* Animated playhead */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(255,255,255,0.7)',
                    left: `${playhead}%`,
                    pointerEvents: 'none',
                    zIndex: 10,
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ShareModal({
  url,
  prompt,
  genre,
  bpm,
  onClose,
}: {
  url: string;
  prompt: string;
  genre: string;
  bpm: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const shareTwitter = () => {
    const text = `Generated a ${genre} MIDI pattern at ${bpm} BPM with pulp. Start generating:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70]"
        style={{ background: 'rgba(10,10,11,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-[71] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 glass-elevated card-tilt-hover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 id="share-modal-title" className="font-extrabold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--foreground)' }}>
            Share generation
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>GENERATION</p>
          <p style={{ fontSize: 14, color: 'var(--foreground)', marginBottom: 8 }}>{prompt || 'Untitled generation'}</p>
          <div className="flex gap-2">
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--accent)',
                background: 'rgba(255,109,63,0.1)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {genre}
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--muted)',
                background: 'var(--surface)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {bpm} BPM
            </span>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            readOnly
            value={url}
            className="input-field"
            style={{ height: 40, fontSize: 12, flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
          />
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="btn-primary btn-sm copy-label-stack"
            data-copied={copied ? 'true' : 'false'}
            style={{ flexShrink: 0 }}
          >
            <span className="copy-label-stack__a">Copy</span>
            <span className="copy-label-stack__b">Copied</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={shareTwitter}
            className="btn-secondary"
            style={{ height: 40, padding: '0 16px', fontSize: 13, flex: 1 }}
          >
            Share on X
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ height: 40, padding: '0 16px', fontSize: 13, flex: 1 }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function Home() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const supabase = useSupabaseWithClerk();
  const e2eBypass = process.env.NEXT_PUBLIC_E2E === '1';
  const effectiveIsSignedIn = e2eBypass ? true : isSignedIn;
  const effectiveUserId = e2eBypass ? 'e2e' : userId;
  const searchParams = useSearchParams();
  const generatorOnly = Boolean(effectiveIsSignedIn);
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [params, setParams] = useState<GenerationParams>(() => {
    const saved = loadPreferences();
    const base = getDefaultParams(saved.defaultGenre);
    return {
      ...base,
      key: saved.defaultKey,
      scale: saved.defaultScale,
      bars: saved.defaultBars,
      ...(saved.defaultBpm !== null ? { bpm: saved.defaultBpm } : {}),
    };
  });
  const [layerInstruments, setLayerInstruments] = useState<Record<string, string>>(DEFAULT_LAYER_INSTRUMENTS);
  const [variations, setVariations] = useState<{ result: GenerationResult; params: GenerationParams }[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [playingVariationIndex, setPlayingVariationIndex] = useState<number | null>(null);
  const playingVariationIndexRef = useRef<number | null>(null);
  useEffect(() => { playingVariationIndexRef.current = playingVariationIndex; }, [playingVariationIndex]);
  const [editorPlayheadBeat, setEditorPlayheadBeat] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [promptHasTyped, setPromptHasTyped] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [bpmHovered, setBpmHovered] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [genBar, setGenBar] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [shareCopied, setShareCopied] = useState(false);
  const [inspireFieldStatus, setInspireFieldStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [totalGenerations, setTotalGenerations] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const playingAllRef = useRef(false);
  useEffect(() => { playingAllRef.current = playingAll; }, [playingAll]);
  const [humanize, setHumanize] = useState(30);
  const humanizeRef = useRef(30);
  useEffect(() => { humanizeRef.current = humanize; }, [humanize]);
  const layerFXRef = useRef<AllLayerFX>({
    melody: { ...DEFAULT_FX },
    chords: { ...DEFAULT_FX },
    bass:   { ...DEFAULT_FX },
    drums:  { ...DEFAULT_FX },
  });
  const [openFXLayer, setOpenFXLayer] = useState<string | null>(null);
  const handleToggleFXPanel = useCallback((layer: string) => {
    setOpenFXLayer(prev => (prev === layer ? null : layer));
  }, []);
  const handleLayerFXChange = useCallback((layer: string, fx: LayerFXSettings) => {
    layerFXRef.current = { ...layerFXRef.current, [layer]: fx } as AllLayerFX;
  }, []);

  const mixerRef = useRef<AllMixerState>(makeDefaultMixer());
  const [mixerUI, setMixerUI] = useState<AllMixerState>(makeDefaultMixer);
  const handleMixerChange = useCallback((layer: keyof AllMixerState, patch: Partial<MixerLayerState>) => {
    const next = { ...mixerRef.current, [layer]: { ...mixerRef.current[layer], ...patch } };
    mixerRef.current = next;
    setMixerUI(next);
    updateAllMixer(next);
  }, []);

  const [matchSoundsPanelOpen, setMatchSoundsPanelOpen] = useState(false);
  const [reversedLayers, setReversedLayers] = useState<Record<string, boolean>>({});
  const [preReversalNotes, setPreReversalNotes] = useState<Record<string, NoteEvent[]>>({});
  const handleReverseLayer = useCallback((layer: typeof LAYERS[number]) => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const currentNotes = sel.result[layer];
    if (reversedLayers[layer]) {
      const original = preReversalNotes[layer] ?? currentNotes;
      setVariations(prev => prev.map((v, i) =>
        i === selectedVariation ? { ...v, result: { ...v.result, [layer]: original } } : v
      ));
      setReversedLayers(prev => ({ ...prev, [layer]: false }));
      setPreReversalNotes(prev => { const n = { ...prev }; delete n[layer]; return n; });
    } else {
      setPreReversalNotes(prev => ({ ...prev, [layer]: currentNotes }));
      setVariations(prev => prev.map((v, i) =>
        i === selectedVariation ? { ...v, result: { ...v.result, [layer]: reverseNotes(currentNotes) } } : v
      ));
      setReversedLayers(prev => ({ ...prev, [layer]: true }));
    }
  }, [variations, selectedVariation, reversedLayers, preReversalNotes]);

  const autoPlayPendingRef = useRef(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIndex, setCompareIndex] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeStyleTag, setActiveStyleTag] = useState<string | null>(null);
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [credits, setCredits] = useState<{
    used: number;
    limit: number;
    isPro: boolean;
    planType?: PlanType;
  } | null>(null);
  const [showMidiUploadModal, setShowMidiUploadModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [exportFlash, setExportFlash] = useState<'midi' | 'ableton' | 'wav' | null>(null);
  const [isRenderingWav, setIsRenderingWav] = useState(false);
  const [isPianoFullscreen, setIsPianoFullscreen] = useState(false);
  const [viewportH, setViewportH] = useState<number>(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const [editorLayer, setEditorLayer] = useState<typeof EDITOR_LAYERS[number]>('melody');
  const [variationIds, setVariationIds] = useState<(string | null)[]>([]);
  const [variationPublic, setVariationPublic] = useState<boolean[]>([]);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [showBpmDetect, setShowBpmDetect] = useState(false);
  const [isDetectingBpm, setIsDetectingBpm] = useState(false);
  const [collabCopied, setCollabCopied] = useState(false);
  const [showInspire, setShowInspire] = useState(false);
  const [inspireText, setInspireText] = useState('');
  const [isInspiring, setIsInspiring] = useState(false);
  const [inspirationChips, setInspirationChips] = useState<string[]>([]);
  const lastInspirationSourceRef = useRef<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [editorView, setEditorView] = useState<'piano' | 'sheet'>('piano');
  const [drumsEditorView, setDrumsEditorView] = useState<'piano' | 'step'>('step');
  const [pianoChordStripVisible, setPianoChordStripVisible] = useState(true);
  const [importedNotes, setImportedNotes] = useState<NoteEvent[]>([]);
  const [showAudioToMidiModal, setShowAudioToMidiModal] = useState(false);
  const [promptCardsDismissed, setPromptCardsDismissed] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [clerkBootTimedOut, setClerkBootTimedOut] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (e2eBypass) return;
    if (isLoaded) {
      setClerkBootTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setClerkBootTimedOut(true), CLERK_BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [e2eBypass, isLoaded]);

  const result = variations[selectedVariation]?.result ?? null;

  const isStudio = Boolean(credits?.isPro && credits?.planType === 'studio');

  const selectedParams = useMemo(() => variations[selectedVariation]?.params ?? params, [variations, selectedVariation, params]);
  const selectedLayerNotes = useMemo(() => {
    if (editorLayer === 'imported') return importedNotes;
    return result?.[editorLayer] ?? [];
  }, [result, editorLayer, importedNotes]);

  const toolRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const onboardingPromptRef = useRef<HTMLDivElement>(null);
  const onboardingPianoRef = useRef<HTMLDivElement>(null);
  const onboardingExportRef = useRef<HTMLDivElement>(null);
  const [generatorInView, setGeneratorInView] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const demoFeaturesRef = useRef<HTMLElement>(null);
  const featuresGridRef = useRef<HTMLDivElement>(null);
  const dawStripRef = useRef<HTMLElement>(null);
  const compareRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = toolRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setGeneratorInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const v = entries[0]?.isIntersecting ?? false;
        if (v) setGeneratorInView(true);
      },
      { root: null, threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ─── SCROLL-TELLING (landing) ────────────────────────────────
  // All effects are driven from scroll position (no intersection observer).
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroP = useSpring(heroProgress, { stiffness: 120, damping: 30, mass: 0.6 });
  const heroGlowX = useTransform(heroP, [0, 1], [0, -24]);
  // Parallax at ~0.3x feel: subtle drift only.
  const heroGlowY = useTransform(heroP, [0, 1], [0, -70]);
  const heroGlowOpacity = useTransform(heroP, [0, 0.35, 1], [0.65, 0.95, 0.55]);
  const heroGlowScale = useTransform(heroP, [0, 1], [1, 1.04]);

  const { scrollYProgress: demoProgress } = useScroll({
    target: demoFeaturesRef,
    offset: ['start 0.9', 'end 0.35'],
  });
  const demoP = useSpring(demoProgress, { stiffness: 140, damping: 32, mass: 0.55 });

  // Demo / features bento: staggered “constructing” reveal with mixed angles.
  const demoCard0T = useTransform(demoP, [0.06, 0.44], [0, 1]);
  const demoCard1T = useTransform(demoP, [0.14, 0.52], [0, 1]);
  const demoCard2T = useTransform(demoP, [0.22, 0.6], [0, 1]);

  const demoCard0X = useTransform(demoCard0T, [0, 1], [-18, 0]);
  const demoCard0Y = useTransform(demoCard0T, [0, 1], [10, 0]);
  const demoCard0R = useTransform(demoCard0T, [0, 1], [-1.0, 0]);
  const demoCard0O = useTransform(demoCard0T, [0, 1], [0, 1]);

  const demoCard1X = useTransform(demoCard1T, [0, 1], [0, 0]);
  const demoCard1Y = useTransform(demoCard1T, [0, 1], [14, 0]);
  const demoCard1R = useTransform(demoCard1T, [0, 1], [0.7, 0]);
  const demoCard1O = useTransform(demoCard1T, [0, 1], [0, 1]);

  const demoCard2X = useTransform(demoCard2T, [0, 1], [18, 0]);
  const demoCard2Y = useTransform(demoCard2T, [0, 1], [10, 0]);
  const demoCard2R = useTransform(demoCard2T, [0, 1], [1.0, 0]);
  const demoCard2O = useTransform(demoCard2T, [0, 1], [0, 1]);

  const { scrollYProgress: dawProgress } = useScroll({
    target: dawStripRef,
    offset: ['start end', 'end start'],
  });
  const dawP = useSpring(dawProgress, { stiffness: 140, damping: 34, mass: 0.55 });
  const dawSpotlightOpacity = useTransform(dawP, [0, 0.5, 1], [0.3, 0.7, 0.3]);

  const { scrollYProgress: compareProgress } = useScroll({
    target: compareRef,
    offset: ['start 0.9', 'end 0.35'],
  });
  const compareP = useSpring(compareProgress, { stiffness: 140, damping: 34, mass: 0.55 });

  // Comparison table: rows reveal one-by-one; pulp column leads by ~50ms feel.
  const cmpRow0T = useTransform(compareP, [0.06, 0.28], [0, 1]);
  const cmpRow1T = useTransform(compareP, [0.14, 0.36], [0, 1]);
  const cmpRow2T = useTransform(compareP, [0.22, 0.44], [0, 1]);
  const cmpRow3T = useTransform(compareP, [0.3, 0.52], [0, 1]);
  const cmpRow4T = useTransform(compareP, [0.38, 0.6], [0, 1]);
  const cmpRow5T = useTransform(compareP, [0.46, 0.68], [0, 1]);
  const cmpRow6T = useTransform(compareP, [0.54, 0.76], [0, 1]);

  const cmpRow0O = useTransform(cmpRow0T, [0, 1], [0, 1]);
  const cmpRow1O = useTransform(cmpRow1T, [0, 1], [0, 1]);
  const cmpRow2O = useTransform(cmpRow2T, [0, 1], [0, 1]);
  const cmpRow3O = useTransform(cmpRow3T, [0, 1], [0, 1]);
  const cmpRow4O = useTransform(cmpRow4T, [0, 1], [0, 1]);
  const cmpRow5O = useTransform(cmpRow5T, [0, 1], [0, 1]);
  const cmpRow6O = useTransform(cmpRow6T, [0, 1], [0, 1]);

  const cmpRow0Y = useTransform(cmpRow0T, [0, 1], [10, 0]);
  const cmpRow1Y = useTransform(cmpRow1T, [0, 1], [10, 0]);
  const cmpRow2Y = useTransform(cmpRow2T, [0, 1], [10, 0]);
  const cmpRow3Y = useTransform(cmpRow3T, [0, 1], [10, 0]);
  const cmpRow4Y = useTransform(cmpRow4T, [0, 1], [10, 0]);
  const cmpRow5Y = useTransform(cmpRow5T, [0, 1], [10, 0]);
  const cmpRow6Y = useTransform(cmpRow6T, [0, 1], [10, 0]);

  const cmpPulp0O = useTransform(compareP, [0.07, 0.22], [0, 1]);
  const cmpPulp1O = useTransform(compareP, [0.15, 0.3], [0, 1]);
  const cmpPulp2O = useTransform(compareP, [0.23, 0.38], [0, 1]);
  const cmpPulp3O = useTransform(compareP, [0.31, 0.46], [0, 1]);
  const cmpPulp4O = useTransform(compareP, [0.39, 0.54], [0, 1]);
  const cmpPulp5O = useTransform(compareP, [0.47, 0.62], [0, 1]);
  const cmpPulp6O = useTransform(compareP, [0.55, 0.7], [0, 1]);

  const cmpOther0O = useTransform(compareP, [0.09, 0.24], [0, 1]);
  const cmpOther1O = useTransform(compareP, [0.17, 0.32], [0, 1]);
  const cmpOther2O = useTransform(compareP, [0.25, 0.4], [0, 1]);
  const cmpOther3O = useTransform(compareP, [0.33, 0.48], [0, 1]);
  const cmpOther4O = useTransform(compareP, [0.41, 0.56], [0, 1]);
  const cmpOther5O = useTransform(compareP, [0.49, 0.64], [0, 1]);
  const cmpOther6O = useTransform(compareP, [0.57, 0.72], [0, 1]);
  const tapTimesRef = useRef<number[]>([]);
  const tapResetTimerRef = useRef<number | null>(null);
  const bpmFileInputRef = useRef<HTMLInputElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const compareTimerRef = useRef<number | null>(null);

  useEffect(() => subscribeToAudioStop(() => {
    if (compareTimerRef.current !== null) window.clearTimeout(compareTimerRef.current);
    compareTimerRef.current = null;
    setCompareMode(false);
    setPlayingAll(false);
    setPlayingVariationIndex(null);
  }), []);

  useEffect(() => {
    if (variations.length > 0) setTemplatesOpen(false);
  }, [variations.length]);

  const closeAllModals = useCallback(() => {
    setShowShortcuts(false);
    setShowEmbedModal(false);
    setShowCommandBar(false);
    setShowUpgradeModal(false);
    setShowHistory(false);
    setShowInspire(false);
    setShowBpmDetect(false);
    setShowAudioToMidiModal(false);
    setShowMidiUploadModal(false);
    setShowShareModal(false);
    setShowDownloadMenu(false);
  }, []);

  const [showKbdShortcutsTrigger, setShowKbdShortcutsTrigger] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setShowKbdShortcutsTrigger(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (editorView !== 'sheet') return;
    if (!sheetCanvasRef.current) return;
    if (!selectedLayerNotes) return;
    drawSheetMusic(sheetCanvasRef.current, selectedLayerNotes, selectedParams, editorLayer);
  }, [editorView, selectedLayerNotes, selectedParams, editorLayer]);

  useEffect(() => {
    if (playingVariationIndex !== selectedVariation) {
      setEditorPlayheadBeat(0);
      return;
    }
    let cancelled = false;
    let raf = 0;
    const start = performance.now();
    const bpm = variations[selectedVariation]?.params.bpm ?? params.bpm;
    const tick = () => {
      if (cancelled) return;
      const elapsed = (performance.now() - start) / 1000;
      setEditorPlayheadBeat(elapsed * (bpm / 60));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playingVariationIndex, selectedVariation, variations, params.bpm]);

  const handleAudioToMidiSuccess = useCallback((detected: NoteEvent[]) => {
    setImportedNotes(detected);
    setEditorLayer('imported');
    setEditorView('piano');
    toast.toast(`Converted to MIDI (${detected.length} notes)`, 'success');
    window.setTimeout(() => toolRef.current?.scrollIntoView({ behavior: 'smooth' }), 120);
  }, [toast]);
  const generateBtnWrapRef = useRef<HTMLDivElement>(null);
  const styleTagsRef = useRef<HTMLDivElement>(null);
  const layerCardsRef = useRef<HTMLDivElement>(null);
  const generatingStageTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const d = (await res.json()) as { totalGenerations: number | null };
        if (typeof d.totalGenerations === 'number' && d.totalGenerations > 0) {
          setTotalGenerations(d.totalGenerations);
        }
      } catch {
        // ignore
      }
    };
    void fetchCount();
  }, []);

  useEffect(() => {
    return () => {
      for (const id of generatingStageTimeoutsRef.current) window.clearTimeout(id);
      generatingStageTimeoutsRef.current = [];
    };
  }, []);

  // Open history from other pages via /?history=1
  useEffect(() => {
    if (searchParams.get('history') === '1') {
      setShowHistory(true);
    }
    const prefill = searchParams.get('prompt');
    if (prefill) {
      setPrompt(prefill);
      setActiveStyleTag(null);
      window.setTimeout(() => promptRef.current?.focus(), 0);
    }
  }, [searchParams]);

  // Mouse spotlight for features grid
  useEffect(() => {
    const el = featuresGridRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  // Track viewport height for fullscreen editor sizing
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandBar(p => !p);
      }
      if (e.key === 'Escape') setShowCommandBar(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── SUPABASE HELPERS ─────────────────────────────────────────

  const loadHistoryFromDb = useCallback(async (uid: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('id, prompt, genre, bpm, style_tag, layers, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10);



      if (error || !data) {
        console.error('[history] loadHistoryFromDb failed', error);
        setHistory([]);
        return;
      }

      const entries: HistoryEntry[] = (data as Array<{
        id: string; prompt: string; genre: string; bpm: number;
        style_tag: string | null; layers: GenerationResult; created_at: string;
      }>).map(row => ({
        id: row.id,
        prompt: row.prompt,
        genre: row.genre,
        key: 'C',
        scale: 'minor',
        bpm: row.bpm,
        bars: 4,
        result: row.layers,
        params: { ...getDefaultParams(), genre: row.genre, bpm: row.bpm },
        timestamp: new Date(row.created_at),
      }));

      setHistory(entries);
    } catch (err) {
      console.error('[history] loadHistoryFromDb threw', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [supabase]);

  const loadInspirationChipsFromDb = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('inspiration_source, created_at')
        .eq('user_id', uid)
        .not('inspiration_source', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data) return;
      const chips = (data as Array<{ inspiration_source: string | null }>)
        .map(r => (r.inspiration_source ?? '').trim())
        .filter(Boolean);

      // Dedupe while preserving order, take last 5
      const uniq: string[] = [];
      for (const c of chips) {
        if (!uniq.includes(c)) uniq.push(c);
        if (uniq.length >= 5) break;
      }
      setInspirationChips(uniq);
    } catch {
      // Ignore
    }
  }, [supabase]);

  useEffect(() => {
    if (!effectiveIsSignedIn || !effectiveUserId || e2eBypass) return;
    void (async () => {
      try {
        const res = await fetch('/api/credits');
        if (!res.ok) return;
        const d = (await res.json()) as {
          credits_used: number;
          limit: number;
          is_pro: boolean;
          plan_type?: PlanType;
        };
        setCredits({
          used: d.credits_used,
          limit: d.limit,
          isPro: d.is_pro,
          planType: d.plan_type ?? (d.is_pro ? 'pro' : 'free'),
        });
      } catch {
        // ignore
      }
    })();
  }, [effectiveIsSignedIn, effectiveUserId, e2eBypass]);

  // Load history when signed in
  useEffect(() => {
    if (!effectiveIsSignedIn || !effectiveUserId) return;
    loadHistoryFromDb(effectiveUserId);
    if (!e2eBypass) loadInspirationChipsFromDb(effectiveUserId);
  }, [effectiveIsSignedIn, effectiveUserId, loadHistoryFromDb, loadInspirationChipsFromDb, e2eBypass]);

  // First-time onboarding (only if 0 generations in Supabase)
  // Note: first-time onboarding is handled by <OnboardingOverlay /> and a localStorage key.

  const handleMidiUploadSuccess = useCallback(
    (data: MidiUploadSuccessPayload) => {
      stopAllAppAudio();
      setPlayingAll(false);
      setParams(data.params);
      setPrompt(data.prompt);
      setVariations(data.variations);
      setSelectedVariation(0);
      setVariationIds(data.variationIds ?? []);
      setVariationPublic((data.variationIds ?? []).map(() => false));
      setActiveStyleTag(null);
      setReversedLayers({});
      setPreReversalNotes({});
      setCredits({
        used: data.credits.credits_used,
        limit: data.credits.limit,
        isPro: data.credits.is_pro,
        planType: data.credits.plan_type,
      });
      setEditorView('piano');
      if (effectiveUserId) void loadHistoryFromDb(effectiveUserId);
      window.setTimeout(() => toolRef.current?.scrollIntoView({ behavior: 'smooth' }), 120);
    },
    [effectiveUserId, loadHistoryFromDb],
  );

  // ── GENERATE ─────────────────────────────────────────────────

  const handleGenerate = useCallback(async (overrideParams?: Partial<GenerationParams>, overridePrompt?: string) => {
    setPromptCardsDismissed(true);
    stopAllAppAudio();
    setPlayingAll(false);

    setGenerationError(null);
    setGenBar('loading');
    setIsGenerating(true);
    setGeneratingStage('Reading prompt...');
    setVariationIds([]);
    setVariationPublic([]);
    posthog.capture('generation_started', {
      genre: params.genre,
      bpm: params.bpm,
      prompt_length: (overridePrompt ?? prompt ?? '').trim().length,
    });

    // Premium staged loading sequence (purely UI timing).
    for (const id of generatingStageTimeoutsRef.current) window.clearTimeout(id);
    generatingStageTimeoutsRef.current = [
      window.setTimeout(() => setGeneratingStage('Reading prompt...'), 0),
      window.setTimeout(() => setGeneratingStage('Drafting melody...'), 800),
      window.setTimeout(() => setGeneratingStage('Voicing chords...'), 1600),
      window.setTimeout(() => setGeneratingStage('Placing bass and drums...'), 2400),
    ];

    // Try Claude AI prompt parsing, fall back silently
    let aiParsed: Partial<GenerationParams> = {};
    const promptText = overridePrompt ?? prompt;
    let pipelinePrompt = (promptText ?? '').trim();
    let artistHints: Partial<GenerationParams> = {};
    if (!e2eBypass && pipelinePrompt) {
      const resolved = await resolveArtistPromptChain(pipelinePrompt);
      pipelinePrompt = resolved.sanitizedPrompt.trim() || pipelinePrompt;
      if (resolved.profile) artistHints = mapArtistProfileToHints(resolved.profile);
    }
    if (!e2eBypass && pipelinePrompt && effectiveIsSignedIn) {
      try {
        const res = await fetch('/api/parse-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: pipelinePrompt }),
        });
        if (res.status === 429) {
          // Fall back to rule-based parser (no toast — avoids noise during typing).
        }
        if (res.ok) {
          const data = await res.json() as { genre?: string; bpm?: number; scale?: string };
          if (data.genre) {
            const genreKey = GENRE_NAME_MAP[data.genre];
            if (genreKey) aiParsed.genre = genreKey;
          }
          if (data.bpm) aiParsed.bpm = Math.max(60, Math.min(180, data.bpm));
          if (data.scale && VALID_SCALES.includes(data.scale)) aiParsed.scale = data.scale;
        }
      } catch {
        // Fall back to rule-based parser silently
      }
    }

    const parsed = pipelinePrompt ? parsePrompt(pipelinePrompt) : {};
    const finalParams: GenerationParams = {
      ...params,
      ...parsed,
      ...artistHints,
      ...aiParsed,
      ...overrideParams,
    };
    setParams(finalParams);

    const minLoad = new Promise<void>(r => window.setTimeout(() => r(), 2800));

    const actualGeneration = (async () => {
      // Tiny intentional delay to avoid an abrupt spinner flash.
      await new Promise<void>(r => window.setTimeout(() => r(), 320));

      let p1: GenerationParams = finalParams;
      let p2: GenerationParams = { ...finalParams, bpm: Math.min(200, finalParams.bpm + 4) };
      let p3: GenerationParams = { ...finalParams, bpm: Math.max(60, finalParams.bpm - 4) };

      const generateViaApiOnce = async () => {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bpm: p1.bpm,
            genre: p1.genre,
            key: p1.key,
            bars: p1.bars,
            prompt: pipelinePrompt ?? '',
          }),
        });

        if (res.status === 429) {
          const d = (await res.json().catch(() => ({}))) as {
            error?: string;
            retryAfter?: number;
            credits_used?: number;
            limit?: number;
            is_pro?: boolean;
          };
          if (d.error === 'Monthly limit reached') {
            if (d.credits_used !== undefined && d.limit !== undefined) {
              setCredits({
                used: d.credits_used,
                limit: d.limit,
                isPro: Boolean(d.is_pro),
              });
            }
            setShowUpgradeModal(true);
            throw new Error('monthly-limit');
          }
          if (d.error === 'Guest limit reached') {
            throw new Error('guest-limit');
          }
          throw new Error('rate-limited');
        }

        if (res.status === 400) {
          const d = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(d?.error || 'invalid input');
        }

        if (res.status === 503) {
          throw new Error('unavailable');
        }

        if (!res.ok) throw new Error('generate failed');
        const data = (await res.json()) as {
          variations: { result: GenerationResult; params: GenerationParams }[];
          credits?: { credits_used: number; limit: number; is_pro: boolean; plan_type?: PlanType };
        };
        if (data.credits) {
          setCredits(prev => ({
            used: data.credits!.credits_used,
            limit: data.credits!.limit,
            isPro: data.credits!.is_pro,
            planType: data.credits!.plan_type ?? prev?.planType ?? (data.credits!.is_pro ? 'pro' : 'free'),
          }));
        }
        return data.variations;
      };

      let gen1: GenerationResult;
      let gen2: GenerationResult;
      let gen3: GenerationResult;
      if (e2eBypass) {
        gen1 = generateTrack(p1);
        gen2 = generateTrack(p2);
        gen3 = generateTrack(p3);
      } else {
        try {
          const variations = await generateViaApiOnce();
          gen1 = variations[0]!.result;
          gen2 = variations[1]!.result;
          gen3 = variations[2]!.result;
          p1 = variations[0]!.params;
          p2 = variations[1]!.params;
          p3 = variations[2]!.params;
        } catch (e) {
          if (e instanceof Error && (e.message === 'monthly-limit' || e.message === 'guest-limit' || e.message === 'rate-limited' || e.message === 'unavailable')) {
            throw e;
          }
          gen1 = generateTrack(p1);
          gen2 = generateTrack(p2);
          gen3 = generateTrack(p3);
        }
      }

      setVariations([
        { result: gen1, params: p1 },
        { result: gen2, params: p2 },
        { result: gen3, params: p3 },
      ]);
      setSelectedVariation(0);
      setReversedLayers({});
      setPreReversalNotes({});

      track('generation_created', {
        genre: finalParams.genre,
        bpm: finalParams.bpm,
        style_tag: activeStyleTag ?? '',
      });
      posthog.capture('generation_completed', {
        genre: finalParams.genre,
        variation_count: 3,
      });

      // Persist to Supabase + update credits
      if (!e2eBypass && effectiveIsSignedIn && effectiveUserId) {
        try {
          const ins = (layers: GenerationResult, p: GenerationParams) =>
            supabase.from('generations').insert({
              user_id: effectiveUserId,
              prompt: pipelinePrompt,
              genre: p.genre,
              bpm: p.bpm,
              style_tag: activeStyleTag,
              layers,
              tags: generateAutoTags(p, layers),
            }).select('id').single();
          const [r1, r2, r3] = await Promise.all([ins(gen1, p1), ins(gen2, p2), ins(gen3, p3)]);
          setVariationIds([r1.data?.id ?? null, r2.data?.id ?? null, r3.data?.id ?? null]);
          setVariationPublic([false, false, false]);

          // Save last inspiration source (best-effort; won't break if column isn't migrated yet)
          const inspirationSource = lastInspirationSourceRef.current;
          if (inspirationSource) {
            const ids = [r1.data?.id, r2.data?.id, r3.data?.id].filter(Boolean) as string[];
            if (ids.length > 0) {
              try {
                await supabase
                  .from('generations')
                  .update({ inspiration_source: inspirationSource })
                  .in('id', ids);
              } catch {
                // Ignore
              }
              // Update chips list from DB for canonical ordering/dedupe.
              try {
                await loadInspirationChipsFromDb(effectiveUserId);
              } catch {
                // Ignore
              }
            }
            lastInspirationSourceRef.current = null;
          }

          await loadHistoryFromDb(effectiveUserId);
        } catch {
          // Ignore save errors
        }
      }
    })();

    let genFailed = false;
    try {
      await Promise.all([actualGeneration, minLoad]);
    } catch (e) {
      genFailed = true;
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'monthly-limit') {
        setGenerationError('Monthly limit reached. Upgrade to keep generating.');
      } else if (msg === 'guest-limit') {
        setGenerationError('Guest limit reached. Sign in to continue.');
      } else if (msg === 'rate-limited') {
        setGenerationError('Rate limited. Try again in a moment.');
      } else if (msg === 'unavailable') {
        setGenerationError('Generation is unavailable. Try again later.');
      } else if (msg === 'invalid input' || msg.includes('invalid')) {
        setGenerationError('Invalid input. Simplify your prompt and try again.');
      } else {
        setGenerationError('Generation failed — the AI is taking a break. Try again in a moment.');
      }
      setGenBar('error');
    } finally {
      setIsGenerating(false);
      setGeneratingStage('');
      for (const id of generatingStageTimeoutsRef.current) window.clearTimeout(id);
      generatingStageTimeoutsRef.current = [];
      if (!genFailed) {
        setGenBar('complete');
        window.setTimeout(() => setGenBar('idle'), 800);
        if (loadPreferences().autoPlay) {
          window.setTimeout(() => autoPlayPendingRef.current = true, 100);
        }
        // Check for newly earned badges (fire-and-forget, signed-in only)
        if (effectiveIsSignedIn) {
          void (async () => {
            try {
              const res = await fetch('/api/badges/check', { method: 'POST' });
              if (res.ok) {
                const data = await res.json() as { newBadges?: { name: string }[] };
                for (const b of data.newBadges ?? []) {
                  toast.toast(`🏆 Badge earned: ${b.name}`, 'success');
                }
              }
            } catch { /* silent */ }
          })();
        }
      }
    }
  }, [params, prompt, e2eBypass, effectiveIsSignedIn, effectiveUserId, activeStyleTag, loadHistoryFromDb, loadInspirationChipsFromDb, supabase, toast]);

  const handleStyleTag = (tag: string) => {
    const preset = STYLE_TAGS[tag];
    if (!preset) return;
    setActiveStyleTag(tag);
    setPrompt(tag.toLowerCase());
    setParams(p => ({ ...p, ...preset }));
    if (!effectiveIsSignedIn) return;
    void handleGenerate(preset, tag.toLowerCase());
    toolRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const runTemplate = useCallback(
    (t: (typeof QUICK_START_TEMPLATES)[number]) => {
      setPromptCardsDismissed(true);
      setTemplatesOpen(false);
      setActiveStyleTag(null);
      setPrompt(t.prompt);
      setParams(p => ({ ...p, ...t.preset }));
      void handleGenerate(t.preset, t.prompt);
      toolRef.current?.scrollIntoView({ behavior: 'smooth' });
      window.setTimeout(() => promptRef.current?.focus(), 0);
    },
    [handleGenerate],
  );

  const toggleLayer = (layer: keyof GenerationParams['layers']) =>
    setParams(p => ({ ...p, layers: { ...p.layers, [layer]: !p.layers[layer] } }));

  const handleToggleAllLayers = () => {
    const allOn = Object.values(params.layers).every(Boolean);
    const v = !allOn;
    setParams(p => ({ ...p, layers: { melody: v, chords: v, bass: v, drums: v } }));
  };

  const handlePlayAll = () => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    if (compareMode) return;
    if (playingAll) {
      stopAllAppAudio();
      setPlayingAll(false);
      return;
    }
    stopAllAppAudio();
    setPlayingAll(true);
    const schedule = () => {
      const raw = {
        melody: params.layers.melody ? sel.result.melody : undefined,
        chords: params.layers.chords ? sel.result.chords : undefined,
        bass: params.layers.bass ? sel.result.bass : undefined,
        drums: params.layers.drums ? sel.result.drums : undefined,
      };
      return playAll(
        applyHumanization(raw, humanizeRef.current, sel.params.bpm),
        sel.params.bpm,
        sel.params.genre,
        () => {
          // Loop until user stops.
          if (!playingAllRef.current) return;
          schedule();
        },
        layerFXRef.current,
        mixerRef.current,
      );
    };
    void schedule();
  };

  useEffect(() => {
    if (autoPlayPendingRef.current && variations.length > 0 && !playingAll) {
      autoPlayPendingRef.current = false;
      handlePlayAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variations]);

  const stopCompare = useCallback((opts?: { stopAudio?: boolean }) => {
    if (compareTimerRef.current !== null) window.clearTimeout(compareTimerRef.current);
    compareTimerRef.current = null;
    setCompareMode(false);
    if (opts?.stopAudio) {
      stopAllAppAudio();
      setPlayingVariationIndex(null);
    }
  }, []);

  const startVariationPlayback = useCallback((i: number) => {
    const v = variations[i];
    if (!v) return;
    stopAllAppAudio();
    setPlayingAll(false);
    setPlayingVariationIndex(i);

    // afro-house loads samples from Supabase Storage via playAll — mix-engine
    // only knows about static /samples/ paths so we bypass it here.
    const genre = v.params.genre;
    if (genre === 'afro_house' || genre === 'afro-house') {
      const schedule = () => playAll(
        {
          melody: params.layers.melody ? v.result.melody : undefined,
          chords: params.layers.chords ? v.result.chords : undefined,
          bass:   params.layers.bass   ? v.result.bass   : undefined,
          drums:  params.layers.drums  ? v.result.drums  : undefined,
        },
        v.params.bpm,
        genre,
        () => {
          window.setTimeout(() => {
            if (playingVariationIndexRef.current !== i) return;
            schedule();
          }, 0);
        },
      );
      void schedule();
      return;
    }

    const schedule = () => playNotes({
      melody: params.layers.melody ? v.result.melody : undefined,
      chords: params.layers.chords ? v.result.chords : undefined,
      bass:   params.layers.bass   ? v.result.bass   : undefined,
      drums:  params.layers.drums  ? v.result.drums  : undefined,
      bpm: v.params.bpm,
      genre: v.params.genre,
      onComplete: () => {
        // Loop until user stops or switches variation.
        window.setTimeout(() => {
          if (playingVariationIndexRef.current !== i) return;
          schedule();
        }, 0);
      },
    });
    schedule();
  }, [variations, params.layers]);

  const startCompare = useCallback(() => {
    if (variations.length === 0) return;
    stopAllAppAudio();
    setPlayingAll(false);
    setCompareMode(true);
    setCompareIndex(0);
    setSelectedVariation(0);
    startVariationPlayback(0);

    const tick = (idx: number) => {
      const v = variations[idx];
      const bpm = v?.params.bpm ?? params.bpm;
      const msPerBeat = 60_000 / Math.max(30, bpm);
      const ms4Bars = msPerBeat * 16;

      compareTimerRef.current = window.setTimeout(() => {
        const next = (idx + 1) % 3;
        setCompareIndex(next);
        setSelectedVariation(next);
        startVariationPlayback(next);
        tick(next);
      }, ms4Bars);
    };

    tick(0);
  }, [variations, params.bpm, startVariationPlayback]);

  useEffect(() => {
    return () => {
      if (compareTimerRef.current !== null) window.clearTimeout(compareTimerRef.current);
    };
  }, []);

  // Keyboard shortcuts effect is declared later (after handler declarations)

  const sliceNotesToBar = useCallback((notes: NoteEvent[], barIndex: number) => {
    const start = barIndex * 4;
    const end = start + 4;
    return notes
      .filter(n => n.startTime >= start && n.startTime < end)
      .map(n => ({ ...n, startTime: n.startTime - start }));
  }, []);

  const handleDownloadLayer = (name: string, notes: NoteEvent[]) => {
    track('midi_downloaded', {
      genre: params.genre,
      layer: name as 'melody' | 'chords' | 'bass' | 'drums',
    });
    const genre = GENRES[params.genre]?.name || 'track';
    const midi = generateMidiFormat0(notes, params.bpm, `pulp-${name}`);
    downloadMidi(midi, `pulp-${name}-${genre.toLowerCase().replace(/\s/g, '-')}-${params.key}${params.scale}.mid`);
  };

  const handleRegenerateLayer = useCallback((layer: typeof LAYERS[number]) => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const singleLayerParams: GenerationParams = {
      ...sel.params,
      layers: { melody: false, chords: false, bass: false, drums: false, [layer]: true },
    };
    const newGen = generateTrack(singleLayerParams);
    setVariations(prev => prev.map((v, i) =>
      i === selectedVariation ? { ...v, result: { ...v.result, [layer]: newGen[layer] } } : v
    ));
    setReversedLayers(prev => ({ ...prev, [layer]: false }));
    setPreReversalNotes(prev => { const n = { ...prev }; delete n[layer]; return n; });
  }, [variations, selectedVariation]);

  const handleEditorNotesChange = useCallback((layer: typeof LAYERS[number], newNotes: NoteEvent[]) => {
    setVariations(prev => prev.map((v, i) =>
      i === selectedVariation ? { ...v, result: { ...v.result, [layer]: newNotes } } : v
    ));
  }, [selectedVariation]);

  const flashExport = useCallback((key: 'midi' | 'ableton' | 'wav') => {
    setExportFlash(key);
    window.setTimeout(() => setExportFlash(null), 1500);
  }, []);

  const handleDownloadAll = () => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
    if (r.melody.length > 0) tracks.push({ name: 'Melody', notes: r.melody, channel: 0 });
    if (r.chords.length > 0) tracks.push({ name: 'Chords', notes: r.chords, channel: 1 });
    if (r.bass.length   > 0) tracks.push({ name: 'Bass',   notes: r.bass,   channel: 2 });
    if (r.drums.length  > 0) tracks.push({ name: 'Drums',  notes: r.drums,  channel: 9 });
    const midi = generateMidiFormat1(tracks, p.bpm);
    const genre = GENRES[p.genre]?.name || 'track';
    track('midi_downloaded', { genre: p.genre, layer: 'full' });
    posthog.capture('midi_exported', { format: 'midi', genre: p.genre });
    downloadMidi(midi, `pulp-${genre.toLowerCase().replace(/\s/g, '-')}-${p.key}${p.scale}.mid`);
    flashExport('midi');
  };

  const handleDownloadTrackOnly = (layer: 'melody' | 'chords' | 'bass' | 'drums') => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const notes =
      layer === 'melody' ? r.melody :
      layer === 'chords' ? r.chords :
      layer === 'bass' ? r.bass :
      r.drums;

    if (!notes || notes.length === 0) {
      toast.toast(`No notes in ${layer}`, 'danger');
      return;
    }

    const channel = layer === 'drums' ? 9 : layer === 'bass' ? 2 : layer === 'chords' ? 1 : 0;
    const name = layer.charAt(0).toUpperCase() + layer.slice(1);
    const midi = generateMidiFormat1([{ name, notes, channel }], p.bpm);
    const genre = GENRES[p.genre]?.name || 'track';
    track('midi_downloaded', { genre: p.genre, layer });
    downloadMidi(midi, `pulp-${layer}-${genre.toLowerCase().replace(/\s/g, '-')}-${p.key}${p.scale}.mid`);
  };

  const handleExportChopAll = useCallback((startBeat: number, endBeat: number) => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const chopTrack = (ns: NoteEvent[]) =>
      ns.filter(n => n.startTime >= startBeat && n.startTime < endBeat)
        .map(n => ({ ...n, startTime: n.startTime - startBeat }));
    const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
    const m = chopTrack(r.melody); if (m.length > 0) tracks.push({ name: 'Melody', notes: m, channel: 0 });
    const ch = chopTrack(r.chords); if (ch.length > 0) tracks.push({ name: 'Chords', notes: ch, channel: 1 });
    const b = chopTrack(r.bass);   if (b.length > 0) tracks.push({ name: 'Bass',   notes: b, channel: 2 });
    const d = chopTrack(r.drums);  if (d.length > 0) tracks.push({ name: 'Drums',  notes: d, channel: 9 });
    if (!tracks.length) return;
    const startBar = Math.round(startBeat / 4) + 1;
    const endBar = Math.round(endBeat / 4);
    const midi = generateMidiFormat1(tracks, p.bpm);
    const genre = GENRES[p.genre]?.name || 'track';
    downloadMidi(midi, `pulp-${genre.toLowerCase().replace(/\s/g, '-')}-bars${startBar}-${endBar}.mid`);
  }, [variations, selectedVariation]);

  const handleDownloadWav = async () => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    if (isRenderingWav) return;

    const { result: r, params: p } = sel;
    setIsRenderingWav(true);
    try {
      const genreLabel = (GENRES[p.genre]?.name || p.genre || 'track').toLowerCase().replace(/\s/g, '-');
      const key = (p.key || 'A').toLowerCase().replace(/[^a-g#b]/g, '');
      const bpm = Math.round(p.bpm);
      const filename = `pulp-${genreLabel}-${key}-${bpm}.wav`;

      const blob = await renderNotesWithMixToWav({
        melody: params.layers.melody ? r.melody : undefined,
        chords: params.layers.chords ? r.chords : undefined,
        bass: params.layers.bass ? r.bass : undefined,
        drums: params.layers.drums ? r.drums : undefined,
        bpm: p.bpm,
        genre: p.genre,
      });

      await downloadBlob(blob, filename);
      toast.toast('WAV exported', 'success');
      flashExport('wav');
    } catch {
      toast.toast('WAV export failed. Try again.', 'danger');
    } finally {
      setIsRenderingWav(false);
    }
  };

  const handleExportAbleton = useCallback(async () => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const safeGenre = (GENRES[p.genre]?.name || p.genre).toLowerCase().replace(/\s/g, '-');
    const filename = `${safeGenre}-${p.bpm}bpm.als`;
    try {
      const blob = await generateAbletonAlsBlob({
        generation: r,
        bpm: p.bpm,
        projectName: `pulp ${safeGenre} ${p.bpm}bpm`,
      });
      await downloadBlob(blob, filename);
      toast.toast('Ableton project exported', 'success');
      posthog.capture('midi_exported', { format: 'ableton', genre: p.genre });
      flashExport('ableton');
    } catch {
      toast.toast('Export failed. Try again.', 'danger');
    }
  }, [variations, selectedVariation, toast, flashExport]);

  const handleDownloadJson = useCallback(() => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const chordProgression = deriveChordProgression(r.chords, p.bars);
    const payload = {
      prompt,
      genre: p.genre,
      bpm: p.bpm,
      bars: p.bars,
      chordProgression,
      layers: r,
      notes: {
        melody: r.melody,
        chords: r.chords,
        bass: r.bass,
        drums: r.drums,
      },
    };
    const safeGenre = (GENRES[p.genre]?.name || p.genre).toLowerCase().replace(/\s/g, '-');
    downloadTextFile(JSON.stringify(payload, null, 2), `pulp-${safeGenre}-${p.bpm}bpm.json`, 'application/json');
  }, [prompt, variations, selectedVariation]);

  const handleDownloadMusicXml = useCallback(() => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    const { result: r, params: p } = sel;
    const title = (prompt || GENRES[p.genre]?.name || 'Pulp generation').slice(0, 64);
    const xml = toMusicXml({
      title,
      bpm: p.bpm,
      bars: p.bars,
      parts: [
        { id: 'P1', name: 'Melody', notes: r.melody },
        { id: 'P2', name: 'Chords', notes: r.chords },
        { id: 'P3', name: 'Bass', notes: r.bass },
        { id: 'P4', name: 'Drums', notes: r.drums },
      ],
    });
    const safeGenre = (GENRES[p.genre]?.name || p.genre).toLowerCase().replace(/\s/g, '-');
    downloadTextFile(xml, `pulp-${safeGenre}-${p.bpm}bpm.musicxml`, 'application/vnd.recordare.musicxml+xml');
  }, [prompt, variations, selectedVariation]);

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setParams(entry.params);
    setVariations([{ result: entry.result, params: entry.params }]);
    setSelectedVariation(0);
    setPrompt(entry.prompt);
    setShowHistory(false);
    setReversedLayers({});
    setPreReversalNotes({});
    toolRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTool = () => toolRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleCmdFocusPrompt = () => {
    scrollToTool();
    setTimeout(() => promptRef.current?.focus(), 150);
  };

  const handleInspire = useCallback(async () => {
    const inspiration = inspireText.trim();
    if (!inspiration) return;
    setIsInspiring(true);
    setInspireFieldStatus('idle');
    try {
      const res = await fetch('/api/inspire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspiration }),
      });
      if (res.status === 429) {
        setInspireFieldStatus('error');
        return;
      }
      if (!res.ok) throw new Error('Failed to inspire');

      const data = await res.json() as {
        genre?: string;
        bpm?: number;
        key?: string;
        scale?: string;
        mood?: string;
        styleTag?: string | null;
        promptSuggestion?: string;
      };

      const genreRaw = (data.genre ?? '').trim();
      const genreKey =
        (genreRaw && GENRES[genreRaw]) ? genreRaw :
          GENRE_NAME_MAP[genreRaw] ??
          Object.entries(GENRES).find(([, g]) => g.name.toLowerCase() === genreRaw.toLowerCase())?.[0] ??
          params.genre;

      const bpm = typeof data.bpm === 'number'
        ? Math.max(60, Math.min(180, Math.round(data.bpm)))
        : params.bpm;

      const keyRaw = (data.key ?? '').trim().toUpperCase();
      const key = (KEYS as readonly string[]).includes(keyRaw) ? keyRaw : params.key;

      const scale = normalizeScaleToEngine(String(data.scale ?? params.scale));

      const styleTag = (typeof data.styleTag === 'string' && data.styleTag.trim()) ? data.styleTag.trim() : null;
      const promptSuggestion = (data.promptSuggestion ?? '').trim();

      setParams(p => ({ ...p, genre: genreKey, bpm, key, scale }));
      if (promptSuggestion) setPrompt(promptSuggestion);
      setActiveStyleTag(styleTag && STYLE_TAGS[styleTag] ? styleTag : null);
      lastInspirationSourceRef.current = inspiration;
      setInspirationChips(prev => {
        const next = [inspiration, ...prev.filter(x => x !== inspiration)];
        return next.slice(0, 5);
      });

      setInspireFieldStatus('success');
      window.setTimeout(() => setInspireFieldStatus('idle'), 1000);
      toast.toast(`Loaded inspiration: ${inspiration}`, 'success');
      setShowInspire(false);
      setInspireText('');
    } catch {
      setInspireFieldStatus('error');
      toast.toast('Inspire failed. Try again.', 'danger');
    } finally {
      setIsInspiring(false);
    }
  }, [inspireText, params.genre, params.bpm, params.key, params.scale, toast]);

  const handleTogglePublic = useCallback(async (variationIndex: number, next: boolean) => {
    const id = variationIds[variationIndex];
    if (!id) return;
    setVariationPublic(prev => { const arr = [...prev]; arr[variationIndex] = next; return arr; });
    try {
      await supabase.from('generations').update({ is_public: next }).eq('id', id).eq('user_id', effectiveUserId!);
    } catch {
      setVariationPublic(prev => { const arr = [...prev]; arr[variationIndex] = !next; return arr; });
    }
    if (next) {
      toast.toast('Now visible in Explore', 'success');
    } else {
      toast.toast('Removed from Explore', 'info');
    }
  }, [variationIds, supabase, effectiveUserId, toast]);

  const handleShare = useCallback(() => {
    const id = variationIds[selectedVariation];
    if (!id) {
      toast.toast('Generate a pattern to share', 'info');
      return;
    }
    const genreKey = variations[selectedVariation]?.params.genre ?? params.genre;
    track('generation_shared', { genre: genreKey });
    posthog.capture('share_clicked', { genre: genreKey });

    const url = `https://pulp.bypapaya.com/g/${id}`;
    void (async () => {
      try {
        // Mark as public (best-effort; copy still works even if DB update fails in dev)
        try {
          await supabase.from('generations').update({ is_public: true }).eq('id', id);
          setVariationPublic(prev => { const next = [...prev]; next[selectedVariation] = true; return next; });
        } catch {
          // ignore
        }
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      } catch {
        toast.toast('Copy failed. Try again.', 'danger');
      }
    })();
  }, [variationIds, selectedVariation, variations, params.genre, toast, supabase]);

  const handleExtendSelected = useCallback(async () => {
    const sel = variations[selectedVariation];
    if (!sel || isGenerating || isExtending) return;

    setIsExtending(true);
    try {
      const existingBars = sel.params.bars;
      const offset = existingBars * 4;

      const lastMelodyPitch = sel.result.melody
        .slice()
        .sort((a, b) => a.startTime - b.startTime)
        .at(-1)?.pitch ?? null;

      const lastBarStart = Math.max(0, (existingBars - 1) * 4);
      const chordNotesInLastBar = sel.result.chords.filter(n => n.startTime >= lastBarStart && n.startTime < lastBarStart + 4);
      const firstChordStart = chordNotesInLastBar.length > 0 ? Math.min(...chordNotesInLastBar.map(n => n.startTime)) : null;
      const lastChordPitches = firstChordStart === null
        ? []
        : chordNotesInLastBar.filter(n => Math.abs(n.startTime - firstChordStart) < 0.05).map(n => n.pitch);

      const continuation = generateTrack(
        { ...sel.params, bars: 8 },
        { lastChordPitches, lastMelodyPitch, startBeat: offset }
      );

      setVariations(prev => prev.map((v, i) => {
        if (i !== selectedVariation) return v;
        return {
          params: { ...v.params, bars: v.params.bars + 8 },
          result: {
            ...v.result,
            melody: [...v.result.melody, ...continuation.melody],
            chords: [...v.result.chords, ...continuation.chords],
            bass:   [...v.result.bass,   ...continuation.bass],
            drums:  [...v.result.drums,  ...continuation.drums],
          },
        };
      }));

      toast.toast('Extended by 8 bars', 'success');
    } catch {
      toast.toast('Extend failed. Try again.', 'danger');
    } finally {
      setIsExtending(false);
    }
  }, [variations, selectedVariation, isGenerating, isExtending, toast]);

  const handleFindSimilar = useCallback(async () => {
    const sel = variations[selectedVariation];
    if (!sel || isFindingSimilar || isGenerating) return;

    stopAllAppAudio();
    setPlayingAll(false);
    setIsFindingSimilar(true);

    // Keep same genre/key/scale, apply slight BPM drift ±5
    const bpmDrift = Math.round((Math.random() - 0.5) * 10);
    const newBpm = Math.max(60, Math.min(200, sel.params.bpm + bpmDrift));
    const similarParams: GenerationParams = { ...sel.params, bpm: newBpm };

    const newIndex = variations.length;

    try {
      let newResult: GenerationResult;
      let finalParams = similarParams;

      if (e2eBypass) {
        newResult = generateTrack(similarParams);
      } else {
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bpm: similarParams.bpm,
              genre: similarParams.genre,
              key: similarParams.key,
              bars: similarParams.bars,
              prompt: prompt ?? '',
            }),
          });
          if (res.status === 429) {
            const d = (await res.json().catch(() => ({}))) as { error?: string };
            if (d.error === 'Monthly limit reached') setShowUpgradeModal(true);
            throw new Error('rate-limited');
          }
          if (!res.ok) throw new Error('generate failed');
          const data = (await res.json()) as {
            variations: { result: GenerationResult; params: GenerationParams }[];
            credits?: { credits_used: number; limit: number; is_pro: boolean; plan_type?: PlanType };
          };
          if (data.credits) {
            setCredits(prev => ({
              used: data.credits!.credits_used,
              limit: data.credits!.limit,
              isPro: data.credits!.is_pro,
              planType: data.credits!.plan_type ?? prev?.planType ?? (data.credits!.is_pro ? 'pro' : 'free'),
            }));
          }
          newResult = data.variations[0]!.result;
          finalParams = data.variations[0]!.params ?? similarParams;
        } catch (e) {
          if (e instanceof Error && e.message === 'rate-limited') throw e;
          newResult = generateTrack(similarParams);
        }
      }

      setVariations(prev => [...prev, { result: newResult, params: finalParams }]);
      setVariationIds(prev => [...prev, null]);
      setVariationPublic(prev => [...prev, false]);
      setSelectedVariation(newIndex);

      // Persist to Supabase in the background
      if (!e2eBypass && effectiveIsSignedIn && effectiveUserId) {
        void supabase.from('generations').insert({
          user_id: effectiveUserId,
          prompt: prompt ?? '',
          genre: finalParams.genre,
          bpm: finalParams.bpm,
          style_tag: activeStyleTag,
          layers: newResult,
          tags: generateAutoTags(finalParams, newResult),
        }).select('id').single().then(r => {
          if (r.data?.id) {
            setVariationIds(prev => {
              const next = [...prev];
              next[newIndex] = r.data!.id ?? null;
              return next;
            });
          }
        });
      }
    } catch {
      toast.toast('Could not generate similar pattern', 'danger');
    } finally {
      setIsFindingSimilar(false);
    }
  }, [variations, selectedVariation, isFindingSimilar, isGenerating, e2eBypass, prompt,
      effectiveIsSignedIn, effectiveUserId, activeStyleTag, supabase, toast]);

  const handleCompletePattern = useCallback(() => {
    const seed = selectedLayerNotes;
    if (!seed || seed.length === 0) {
      toast.toast('Draw a few notes first', 'info');
      return;
    }

    const seedSorted = [...seed].sort((a, b) => a.startTime - b.startTime);
    const lastPitch = seedSorted.at(-1)?.pitch ?? null;
    const { key, scale } = detectKeyScaleFromSeed(seedSorted);

    const currentBars = selectedParams.bars ?? 4;
    const offset = currentBars * 4;

    const targetLayer = (editorLayer === 'imported' ? 'melody' : editorLayer) as 'melody' | 'chords' | 'bass' | 'drums';

    const layerParams: GenerationParams = {
      ...selectedParams,
      key,
      scale,
      bars: 8,
      layers: { melody: false, chords: false, bass: false, drums: false, [targetLayer]: true } as GenerationParams['layers'],
    };

    // Use music-engine continuation seeded by user's notes (rhythm + contour) for melodic layers.
    const cont = generateTrack(layerParams, {
      lastMelodyPitch: lastPitch,
      startBeat: offset,
      seedNotes: seedSorted,
    });

    const newNotes = cont[targetLayer];

    if (editorLayer === 'imported') {
      setImportedNotes(prev => [...prev, ...newNotes]);
    } else {
      setVariations(prev => prev.map((v, i) => {
        if (i !== selectedVariation) return v;
        return {
          params: { ...v.params, bars: (v.params.bars ?? 4) + 8 },
          result: { ...v.result, [editorLayer]: [...(v.result as any)[editorLayer], ...newNotes] },
        };
      }));
    }

    toast.toast('Added 8 bars', 'success');
  }, [selectedLayerNotes, selectedParams, editorLayer, selectedVariation, toast]);

  const handleCreateCollab = useCallback(() => {
    const sessionId = crypto.randomUUID();
    const url = `${window.location.origin}/collab/${sessionId}`;
    void navigator.clipboard.writeText(url);
    setCollabCopied(true);
    setTimeout(() => setCollabCopied(false), 2000);
  }, []);

  const handleTapTempo = useCallback(() => {
    const now = Date.now();

    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
    }
    tapResetTimerRef.current = window.setTimeout(() => {
      tapTimesRef.current = [];
      setDetectedBpm(null);
    }, 3000);

    const times = tapTimesRef.current;
    times.push(now);
    // Keep the last 5 taps to compute up to 4 intervals
    if (times.length > 5) times.splice(0, times.length - 5);

    if (times.length < 2) return;
    const intervals: number[] = [];
    for (let i = Math.max(1, times.length - 4); i < times.length; i++) {
      intervals.push(times[i]! - times[i - 1]!);
    }
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (!Number.isFinite(avgMs) || avgMs <= 0) return;

    const bpm = Math.round(60000 / avgMs);
    const clamped = Math.max(60, Math.min(200, bpm));
    setDetectedBpm(clamped);
    setParams(p => ({ ...p, bpm: clamped }));
  }, []);

  const estimateBpmFromAudioBuffer = useCallback(async (buffer: AudioBuffer): Promise<number | null> => {
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const sr = buffer.sampleRate;

    const maxSeconds = Math.min(60, Math.max(10, buffer.duration));
    const maxSamples = Math.min(ch0.length, Math.floor(sr * maxSeconds));

    const winSize = Math.max(256, Math.floor(sr * 0.01)); // ~10ms
    const hop = winSize;
    const env: number[] = [];

    for (let i = 0; i + winSize < maxSamples; i += hop) {
      let sum = 0;
      for (let j = 0; j < winSize; j++) {
        const s0 = ch0[i + j] ?? 0;
        const s1 = ch1 ? (ch1[i + j] ?? 0) : 0;
        const s = ch1 ? (s0 + s1) * 0.5 : s0;
        sum += s * s;
      }
      env.push(Math.sqrt(sum / winSize));
    }
    if (env.length < 20) return null;

    // Smooth
    const smooth: number[] = new Array(env.length).fill(0);
    const k = 3;
    for (let i = 0; i < env.length; i++) {
      let s = 0;
      let n = 0;
      for (let t = -k; t <= k; t++) {
        const v = env[i + t];
        if (typeof v === 'number') { s += v; n++; }
      }
      smooth[i] = s / Math.max(1, n);
    }

    // Threshold via median + MAD
    const sorted = [...smooth].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const absDev = smooth.map(v => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = absDev[Math.floor(absDev.length / 2)] ?? 0;
    const threshold = median + mad * 3.5;

    // Peak picking with refractory period (~200ms)
    const peakIdx: number[] = [];
    const minDist = Math.floor((0.2 * sr) / hop);
    let last = -Infinity;
    for (let i = 1; i < smooth.length - 1; i++) {
      const v = smooth[i] ?? 0;
      if (v < threshold) continue;
      if (v > (smooth[i - 1] ?? 0) && v >= (smooth[i + 1] ?? 0)) {
        if (i - last >= minDist) {
          peakIdx.push(i);
          last = i;
        }
      }
    }
    if (peakIdx.length < 6) return null;

    const intervals: number[] = [];
    for (let i = 1; i < peakIdx.length; i++) {
      const dtFrames = peakIdx[i]! - peakIdx[i - 1]!;
      const dtSec = (dtFrames * hop) / sr;
      if (dtSec >= 0.2 && dtSec <= 2.0) intervals.push(dtSec);
    }
    if (intervals.length < 4) return null;

    intervals.sort((a, b) => a - b);
    const trim = Math.floor(intervals.length * 0.15);
    const core = intervals.slice(trim, intervals.length - trim);
    const avg = core.reduce((a, b) => a + b, 0) / Math.max(1, core.length);
    if (!isFinite(avg) || avg <= 0) return null;

    let bpm = 60 / avg;
    while (bpm < 60) bpm *= 2;
    while (bpm > 200) bpm /= 2;
    const rounded = Math.round(bpm);
    if (rounded < 60 || rounded > 200) return null;
    return rounded;
  }, []);

  const handleDetectBpmFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsDetectingBpm(true);
    try {
      const arr = await file.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audio = await ctx.decodeAudioData(arr.slice(0));
      const bpm = await estimateBpmFromAudioBuffer(audio);
      await ctx.close().catch(() => {});

      if (!bpm) throw new Error('No BPM');

      setParams(p => ({ ...p, bpm }));
      setDetectedBpm(bpm);
      toast.toast(`BPM detected: ${bpm}`, 'success');
      setShowBpmDetect(false);
    } catch {
      toast.toast('BPM detection failed. Try again.', 'danger');
    } finally {
      setIsDetectingBpm(false);
      if (bpmFileInputRef.current) bpmFileInputRef.current.value = '';
    }
  }, [estimateBpmFromAudioBuffer, toast]);

  // ── KEYBOARD SHORTCUTS ───────────────────────────────────────
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const isCombo = e.metaKey || e.ctrlKey;

      // ESC: dismiss top overlay first (no audio teardown), then fullscreen, then global reset
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (showCommandBar) {
          setShowCommandBar(false);
          return;
        }
        if (showShareModal) {
          setShowShareModal(false);
          return;
        }
        if (showEmbedModal) {
          setShowEmbedModal(false);
          setEmbedCopied(false);
          return;
        }
        if (showDownloadMenu) {
          setShowDownloadMenu(false);
          return;
        }
        if (showMidiUploadModal) {
          setShowMidiUploadModal(false);
          return;
        }
        if (showAudioToMidiModal) {
          setShowAudioToMidiModal(false);
          return;
        }
        if (showUpgradeModal) {
          setShowUpgradeModal(false);
          return;
        }
        if (showHistory) {
          setShowHistory(false);
          return;
        }
        if (showInspire) {
          setShowInspire(false);
          return;
        }
        if (showBpmDetect) {
          setShowBpmDetect(false);
          return;
        }
        if (showManual) {
          setShowManual(false);
          return;
        }
        if (isPianoFullscreen) {
          setIsPianoFullscreen(false);
          return;
        }
        stopCompare({ stopAudio: true });
        stopAllAppAudio();
        setPlayingVariationIndex(null);
        setPlayingAll(false);
        closeAllModals();
        return;
      }

      // '?' opens shortcuts (not while typing)
      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !isTypingTarget(e.target)) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Don't steal keystrokes while typing (except cmd/ctrl combos and ESC/? handled above)
      if (!isCombo && isTypingTarget(e.target)) return;

      // Cmd/Ctrl shortcuts
      if (isCombo) {
        const k = e.key.toLowerCase();
        if (k === 'k') {
          e.preventDefault();
          setShowCommandBar(true);
          return;
        }
        if (k === 's') {
          if (variations.length === 0) return;
          e.preventDefault();
          if (e.shiftKey) void handleDownloadWav();
          else handleDownloadAll();
          return;
        }
        if (k === 'e') {
          e.preventDefault();
          void handleExtendSelected();
          return;
        }
      }

      // Single-key shortcuts
      if (e.key === ' ') {
        e.preventDefault();
        if (compareMode) {
          stopCompare();
          startVariationPlayback(compareIndex);
          return;
        }
        if (playingVariationIndex === selectedVariation) {
          stopAllAppAudio();
          setPlayingVariationIndex(null);
        } else {
          startVariationPlayback(selectedVariation);
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'b' && !isCombo) {
        e.preventDefault();
        window.open('/blog', '_blank', 'noopener,noreferrer');
        return;
      }
      if (key === 'p' && !isCombo) {
        e.preventDefault();
        window.location.href = '/pricing';
        return;
      }
      if (key === 'r' && !isCombo) {
        e.preventDefault();
        if (variations.length > 0) void handleGenerate();
        return;
      }
      if (key === 'i' && !isCombo) {
        e.preventDefault();
        setShowInspire(v => !v);
        return;
      }
      if (key === 's' && !isCombo && variations.length > 0) {
        e.preventDefault();
        setShowShareModal(true);
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        void handleGenerate();
        return;
      }
      if (key === 'f' && !isCombo) {
        if (editorView !== 'piano') return;
        if (variations.length === 0) return;
        e.preventDefault();
        setIsPianoFullscreen(true);
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        if (compareMode) stopCompare({ stopAudio: true });
        else startCompare();
        return;
      }
      if (key === 'e' && !isCombo) {
        if (variations.length === 0) return;
        e.preventDefault();
        setEditorView(v => (v === 'piano' ? 'sheet' : 'piano'));
        return;
      }
      if (key === 'd' && !isCombo) {
        if (variations.length === 0) return;
        e.preventDefault();
        setPianoChordStripVisible(v => !v);
        return;
      }
      if (key === '1' || key === '2' || key === '3') {
        e.preventDefault();
        const idx = Number(key) - 1;
        if (!variations[idx]) return;
        stopCompare({ stopAudio: true });
        stopAllAppAudio();
        setPlayingVariationIndex(null);
        setPlayingAll(false);
        setSelectedVariation(idx);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    closeAllModals,
    compareIndex,
    compareMode,
    editorView,
    handleDownloadAll,
    handleDownloadWav,
    handleExtendSelected,
    handleGenerate,
    isPianoFullscreen,
    setShowInspire,
    setShowShareModal,
    playingVariationIndex,
    selectedVariation,
    showAudioToMidiModal,
    showBpmDetect,
    showCommandBar,
    showDownloadMenu,
    showEmbedModal,
    showHistory,
    showInspire,
    showManual,
    showMidiUploadModal,
    showShareModal,
    showShortcuts,
    showUpgradeModal,
    startCompare,
    startVariationPlayback,
    stopCompare,
    variations,
  ]);

  // Navbar command button (⌘K)
  useEffect(() => {
    const onOpen = () => setShowCommandBar(true);
    window.addEventListener('pulp:open-command-bar', onOpen as EventListener);
    return () => window.removeEventListener('pulp:open-command-bar', onOpen as EventListener);
  }, []);

  // ── RENDER ────────────────────────────────────────────────
  if (mounted && !e2eBypass && !isLoaded) {
    if (clerkBootTimedOut) {
      return <ClerkConnectionFallback onRetry={() => window.location.reload()} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>

      <OnboardingOverlay
        promptRef={onboardingPromptRef}
        pianoRef={onboardingPianoRef}
        exportRef={onboardingExportRef}
        enabled={generatorInView}
      />

      {/* ── COMMAND BAR ── */}
      <CommandBar
        isOpen={showCommandBar}
        onClose={() => setShowCommandBar(false)}
        onGenerate={() => { if (effectiveIsSignedIn) { void handleGenerate(); } else setShowCommandBar(false); }}
        onFocusPrompt={handleCmdFocusPrompt}
        onToggleLayers={handleToggleAllLayers}
        onDownloadAll={handleDownloadAll}
        onOpenBlog={() => window.open('/blog', '_blank', 'noopener,noreferrer')}
        onOpenInspire={() => setShowInspire(true)}
        onGoToPricing={() => { window.location.href = '/pricing'; }}
        hasResult={variations.length > 0}
      />

      {/* ── SHORTCUTS MODAL ── */}
      {mounted && showShortcuts && createPortal(
        <>
          {/* Overlay */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowShortcuts(false)}
          />
          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10000,
              width: 'min(680px, 90vw)',
              maxHeight: '80vh',
              background: '#0A0A0B',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — fixed, never scrolls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  color: '#FFFFFF',
                }}
              >
                Keyboard shortcuts
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowShortcuts(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 24px' }}>
              {SHORTCUT_OVERLAY_GROUPS.map((group, gi) => (
                <div key={group.title} style={{ marginTop: gi > 0 ? 24 : 0 }}>
                  <div
                    style={{
                      fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                      fontWeight: 600,
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 6,
                    }}
                  >
                    {group.title}
                  </div>
                  <div>
                    {group.rows.map(row => (
                      <div
                        key={`${group.title}-${row.k}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          height: 40,
                          padding: '0 12px',
                          borderRadius: 8,
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            marginRight: 16,
                            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                            fontSize: 14,
                            lineHeight: 1.4,
                            color: 'rgba(255,255,255,0.65)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.d}
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            lineHeight: 1,
                            color: 'rgba(255,255,255,0.9)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.07)',
                            padding: '5px 9px',
                            borderRadius: 7,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.k}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {showKbdShortcutsTrigger && (
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          title="Shortcuts (?)"
          className="fixed z-[38] flex h-10 w-10 items-center justify-center rounded-xl transition-opacity hover:opacity-95"
          style={{
            bottom: 24,
            left: 24,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(10,10,11,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={() => setShowShortcuts(true)}
        >
          ⌘
        </button>
      )}

      <AnimatePresence>
        {showShareModal && variationIds[selectedVariation] && (
          <ShareModal
            url={`${window.location.origin}/g/${variationIds[selectedVariation]}`}
            prompt={prompt}
            genre={GENRES[params.genre]?.name || params.genre}
            bpm={variations[selectedVariation]?.params.bpm ?? params.bpm}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </AnimatePresence>

      {/* ── EMBED MODAL ── */}
      <AnimatePresence>
        {showEmbedModal && (
          <>
            <motion.div
              className="fixed inset-0 z-40 backdrop-blur-md"
              style={{ background: 'rgba(10,10,11,0.55)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { setShowEmbedModal(false); setEmbedCopied(false); }}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[41] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: EASE_UI }}
              role="dialog"
              aria-modal="true"
              aria-label="Embed"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
                    Embed
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Paste this iframe into your site.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEmbedModal(false); setEmbedCopied(false); }}
                  className="h-9 px-3 rounded-lg text-xs transition-all"
                  style={{
                    border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                    color: 'var(--text)',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'transparent',
                  }}
                >
                  Esc
                </button>
              </div>

              <div
                className="mt-5 rounded-xl p-4"
                style={{ border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}
              >
                <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                  {'<iframe src="https://pulp.bypapaya.com/embed" width="100%" height="400" frameborder="0"></iframe>'}
                </code>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => { setShowEmbedModal(false); setEmbedCopied(false); }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-download btn-sm copy-label-stack"
                  data-copied={embedCopied ? 'true' : 'false'}
                  onClick={async () => {
                    const code = `<iframe src="https://pulp.bypapaya.com/embed" width="100%" height="400" frameborder="0"></iframe>`;
                    try {
                      await navigator.clipboard.writeText(code);
                      setEmbedCopied(true);
                      window.setTimeout(() => setEmbedCopied(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <span className="copy-label-stack__a">Copy code</span>
                  <span className="copy-label-stack__b">Copied</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── UPGRADE MODAL ── */}
      <AnimatePresence>
        {showUpgradeModal && (
          <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
        )}
      </AnimatePresence>

      <StudioMidiUploadModal
        open={showMidiUploadModal}
        onClose={() => setShowMidiUploadModal(false)}
        onSuccess={handleMidiUploadSuccess}
      />

      <StudioAudioToMidiModal
        open={showAudioToMidiModal}
        onClose={() => setShowAudioToMidiModal(false)}
        onSuccess={handleAudioToMidiSuccess}
        mode={isStudio ? 'studio' : 'locked'}
      />

      {/* ── HISTORY SIDEBAR ── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              className="fixed inset-0 z-30 backdrop-blur-md"
              style={{ background: 'rgba(10,10,11,0.50)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowHistory(false)}
            />
            <HistorySidebar
              history={history}
              loading={historyLoading}
              onRestore={handleRestoreHistory}
              onClose={() => setShowHistory(false)}
              isSignedIn={Boolean(effectiveIsSignedIn)}
              userId={effectiveUserId ?? null}
              supabase={supabase}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── NAV ── */}
      <Navbar
        active="create"
        onHistory={() => setShowHistory(true)}
        historyCount={history.length}
      />

      <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {!generatorOnly && (
      <>
      {/* SEO: crawlable static copy — visually hidden, not aria-hidden so bots index it */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <h1>pulp — AI MIDI Generator for Music Producers</h1>
        <p>Generate professional multi-track MIDI from text prompts. Melody, chords, bass, and drums in seconds. Export to Ableton, FL Studio, Logic Pro and any DAW. 20+ genres including Tech House, Deep House, Afro House, Hip Hop, Trap, Lo-Fi and more.</p>
        <h2>Features</h2>
        <p>Natural language prompts, piano roll editor, one-click DAW export, REST API, 20 plus genre models, MIDI and WAV export.</p>
        <h2>Pricing</h2>
        <p>Free plan with 20 generations per month. Pro plan at 7 dollars per month with 150 generations. Studio plan at 19 dollars per month with 600 generations.</p>
      </div>
      {/* ── HERO ── */}
      <section ref={heroRef} className="relative overflow-hidden px-4 sm:px-8 pb-28 pt-24" style={{ background: 'var(--bg)' }}>
        {/* Subtle depth: grid pattern + hero glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 85%)',
            maskImage: 'radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 85%)',
          }}
        />
        {/* Left ambient glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(255,109,63,0.04) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            right: -80,
            top: '50%',
            width: 700,
            height: 700,
            transform: 'translateY(-50%)',
            background: 'radial-gradient(circle, rgba(255,109,63,0.14) 0%, rgba(255,109,63,0.06) 35%, transparent 70%)',
            pointerEvents: 'none',
            x: prefersReducedMotion ? 0 : heroGlowX,
            y: prefersReducedMotion ? 0 : heroGlowY,
            opacity: prefersReducedMotion ? 0.7 : heroGlowOpacity,
            scale: prefersReducedMotion ? 1 : heroGlowScale,
          }}
        />
        <div className="mx-auto max-w-[920px]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_UI }}
          >
            <p
              className="mb-6 text-[11px] font-medium uppercase tracking-[0.22em] text-left"
              style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 500, color: 'var(--accent)' }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#FF6D3F',
                  marginRight: 8,
                  verticalAlign: 'middle',
                  animation: 'pulseOrange 2s ease-in-out infinite',
                }}
              />
              Built for modern producers
            </p>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(28,28,36,0.72)',
                background: 'rgba(255,109,63,0.08)',
                border: '1px solid rgba(255,109,63,0.22)',
                boxShadow: '0 0 12px rgba(255,109,63,0.08)',
                borderRadius: 20,
                padding: '4px 12px',
                marginBottom: 16,
              }}
            >
              Multi-track MIDI, ready for your DAW
            </span>
            <h1
              className="font-extrabold leading-[1.05] tracking-tight text-left"
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(2.25rem, 6vw, 4rem)',
                color: 'var(--text)',
                letterSpacing: '-0.02em',
                lineHeight: 1.12,
              }}
            >
              Go from prompt to playable idea in under a minute.
            </h1>
            <p
              className="mt-6 max-w-[620px] text-[16px] leading-snug sm:text-[18px] text-left"
              style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 400, color: 'var(--muted)', lineHeight: 1.6 }}
            >
              Describe a genre, reference, or mood. pulp gives you melody, chords, bass, and drums in one shot, then lets you preview, edit, and drag everything straight into your session.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-start gap-4 sm:mt-12 sm:flex-row sm:items-center sm:justify-start">
              {effectiveIsSignedIn ? (
                <Link
                  href="/dashboard"
                  className="btn-primary btn-hero"
                  style={{ textDecoration: 'none' }}
                >
                  Start a new idea
                </Link>
              ) : (
                <SignInButtonDeferred mode="modal">
                  <button
                    type="button"
                    className="btn-primary btn-hero w-full sm:w-auto"
                  >
                    Start a new idea
                  </button>
                </SignInButtonDeferred>
              )}
              <a
                href="#demo"
                className="btn-secondary btn-sm"
                style={{
                  height: 48,
                  padding: '0 22px',
                  textDecoration: 'none',
                }}
              >
                See workflow
              </a>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: '0.04em',
                color: '#00B894',
                background: 'rgba(0,184,148,0.08)',
                border: '1px solid rgba(0,184,148,0.2)',
                borderRadius: 20,
                padding: '4px 10px',
              }}>
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden>
                  <path d="M1 4l3 3.5L10 1" stroke="#00B894" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                100% Royalty-Free — MIDI is yours
              </span>
            </div>
          </motion.div>
        </div>

        {/* ── HERO DEMO VIDEO ──
            To swap in a real video: replace the inner <div> wrapper with:
            <video src="YOUR_SRC" autoPlay muted loop playsInline style={videoStyle} />
        */}
        <div className="relative z-10 mx-auto mt-14 w-full px-4 sm:px-0" style={{ maxWidth: 800 }}>
          <div
            style={{
              position: 'relative',
              minHeight: 420,
              background: 'linear-gradient(180deg, rgba(17,17,24,0.98) 0%, rgba(10,10,11,1) 100%)',
              border: '1px solid #1A1A2E',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#FF6D3F',
                      boxShadow: '0 0 12px rgba(255,109,63,0.45)',
                    }}
                  />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.76)' }}>
                    Prompt: afro house groove, warm bass, festival chords
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: '#00B894',
                    background: 'rgba(0,184,148,0.08)',
                    border: '1px solid rgba(0,184,148,0.2)',
                    borderRadius: 999,
                    padding: '5px 9px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ready to export
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.35fr_0.85fr]">
                <div
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.025)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      minHeight: 274,
                    }}
                  >
                    <div
                      style={{
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '14px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {['Chords', 'Bass', 'Melody', 'Drums'].map((layer, index) => (
                        <div
                          key={layer}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: index === 2 ? 'var(--text)' : 'rgba(255,255,255,0.55)',
                            background: index === 2 ? 'rgba(255,109,63,0.12)' : 'transparent',
                            border: index === 2 ? '1px solid rgba(255,109,63,0.25)' : '1px solid transparent',
                            borderRadius: 8,
                            padding: '8px 10px',
                          }}
                        >
                          {layer}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        padding: 16,
                        backgroundImage:
                          'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                        backgroundSize: '40px 32px',
                      }}
                    >
                      {[
                        { top: 42, left: 36, width: 92 },
                        { top: 74, left: 144, width: 70 },
                        { top: 106, left: 238, width: 86 },
                        { top: 138, left: 116, width: 110 },
                        { top: 170, left: 308, width: 74 },
                        { top: 202, left: 196, width: 96 },
                      ].map((note, index) => (
                        <div
                          key={`${note.left}-${note.top}-${index}`}
                          style={{
                            position: 'absolute',
                            top: note.top,
                            left: note.left,
                            width: note.width,
                            height: 18,
                            borderRadius: 6,
                            background: index % 2 === 0 ? 'rgba(255,109,63,0.92)' : 'rgba(255,109,63,0.65)',
                            boxShadow: '0 0 18px rgba(255,109,63,0.18)',
                          }}
                        />
                      ))}
                      <div
                        style={{
                          position: 'absolute',
                          top: 18,
                          bottom: 16,
                          left: '56%',
                          width: 2,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.5)',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.025)',
                      padding: 16,
                    }}
                  >
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                      MIX VIEW
                    </p>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {[
                        ['Chords', '0.0 dB'],
                        ['Bass', '-1.5 dB'],
                        ['Melody', '-0.8 dB'],
                        ['Drums', '+1.2 dB'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.62)' }}>{label}</span>
                          <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: label === 'Drums' ? '82%' : label === 'Melody' ? '68%' : label === 'Bass' ? '72%' : '76%',
                                height: '100%',
                                background: 'linear-gradient(90deg, rgba(255,109,63,0.42) 0%, rgba(255,109,63,0.95) 100%)',
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.62)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.025)',
                      padding: 16,
                    }}
                  >
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                      EXPORTS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['MIDI', 'WAV', 'Ableton Live Set', 'MusicXML'].map((format) => (
                        <span
                          key={format}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.8)',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '6px 10px',
                          }}
                        >
                          {format}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 10,
                        border: '1px solid rgba(255,109,63,0.2)',
                        background: 'rgba(255,109,63,0.08)',
                        padding: '12px 14px',
                      }}
                    >
                      <p style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                        Built for sketching faster, then taking full control inside Ableton, FL Studio, Logic Pro, or wherever you finish records.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Works with any DAW strip */}
      <motion.section ref={dawStripRef} className="relative px-4 sm:px-8 py-20" {...scrollSection}>
        <div aria-hidden className="noise-overlay" />
        <div className="mx-auto max-w-[1200px] text-center">
          <p
            className="mb-4 text-[11px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}
          >
            Fits the workflow you already have
          </p>
          <p
            className="mx-auto mb-8 max-w-[720px] text-[15px] leading-relaxed"
            style={{ fontFamily: 'DM Sans, system-ui, sans-serif', color: 'var(--muted)' }}
          >
            Start ideas in pulp, then keep arranging, sound-designing, and finishing inside your main DAW without changing your process.
          </p>
        </div>
        <motion.div
          className="mx-auto max-w-[1200px] mobile-scroll-row"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            letterSpacing: '0.02em',
            color: 'var(--muted)',
            opacity: prefersReducedMotion ? 0.68 : dawSpotlightOpacity,
          }}
        >
          <div className="row w-full items-center justify-start sm:justify-center" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <span>FL Studio</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Ableton Live</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Logic Pro</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Cubase</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Studio One</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Bitwig</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Reaper</span>
          </div>
        </motion.div>
      </motion.section>


      {/* ── DEMO / FEATURES ── */}
      <motion.section id="demo" className="mt-24 px-4 sm:px-8 py-24" style={{ background: 'var(--bg)' }} ref={demoFeaturesRef} {...scrollSection}>
        <div ref={featuresGridRef} className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {[
            {
              title: 'Reference-aware prompting',
              body: 'Drop an artist name and pulp maps their signature sound — tempo, key, chord style, and groove — into your MIDI.',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--accent)]">
                  <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              title: 'Browser-side control',
              body: 'Preview, edit, humanize, flip, slice, and rebalance each layer before anything touches your DAW.',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--accent)]">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 15V9M10 15v-4M13 15V8M16 15v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              title: 'Export like a real session',
              body: 'Take MIDI, WAV, Ableton Live Set, and more straight into the tools you already use to finish tracks.',
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--accent)]">
                  <path d="M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ),
            },
          ].map((card, idx) => (
            <motion.div
              key={card.title}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[rgba(255,109,63,0.45)] md:p-8"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 0 rgba(255,255,255,0.03)',
                transition: 'all 200ms ease',
                opacity: prefersReducedMotion ? 1 : (idx === 0 ? demoCard0O : idx === 1 ? demoCard1O : demoCard2O),
                x: prefersReducedMotion ? 0 : (idx === 0 ? demoCard0X : idx === 1 ? demoCard1X : demoCard2X),
                y: prefersReducedMotion ? 0 : (idx === 0 ? demoCard0Y : idx === 1 ? demoCard1Y : demoCard2Y),
                rotate: prefersReducedMotion ? 0 : (idx === 0 ? demoCard0R : idx === 1 ? demoCard1R : demoCard2R),
              }}
              whileHover={{ y: -4 }}
            >
              {/* Mouse spotlight overlay */}
              <div
                aria-hidden
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'inherit',
                  background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.04), transparent 40%)',
                  zIndex: 0,
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="mb-5 flex items-start gap-4">
                  {card.icon}
                  <h2
                    className="text-lg font-bold leading-tight"
                    style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}
                  >
                    {card.title}
                  </h2>
                </div>
                <p className="text-[15px] leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--muted)' }}>
                  {card.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── HOW IT WORKS ── */}
      <motion.section className="px-4 sm:px-8 py-24" style={{ background: 'var(--bg)' }} {...scrollSection}>
        <div className="mx-auto max-w-[1100px]">
          {/* Header */}
          <div className="mb-16 text-center">
            <p
              className="mb-4 text-[11px] uppercase tracking-[0.12em]"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: 'var(--accent)' }}
            >
              How it works
            </p>
            <h2
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: 'var(--text)',
              }}
            >
              From idea to session in seconds.
            </h2>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <div
              className="relative rounded-2xl p-8 flex flex-col gap-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 24,
                  fontSize: 80,
                  fontWeight: 800,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  color: 'var(--accent)',
                  opacity: 0.12,
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                1
              </span>
              <div style={{ color: 'var(--accent)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 9h5M7 12h8M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <rect x="14" y="11" width="1.5" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  Describe your sound
                </p>
                <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
                  Type a genre, mood, tempo, or artist name. Be as vague or specific as you want — pulp understands both.
                </p>
              </div>
              {/* Fake input */}
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3 mt-auto"
                style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 1 }}>✦</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  dark melodic techno, 128bpm, minor key
                </span>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 14,
                    background: 'var(--accent)',
                    borderRadius: 1,
                    marginLeft: 2,
                    animation: 'pulseOrange 1s ease-in-out infinite',
                  }}
                />
              </div>
            </div>

            {/* Step 2 */}
            <div
              className="relative rounded-2xl p-8 flex flex-col gap-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 24,
                  fontSize: 80,
                  fontWeight: 800,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  color: 'var(--accent)',
                  opacity: 0.12,
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                2
              </span>
              <div style={{ color: 'var(--accent)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 15V9M10 15v-4M13 15V8M16 15v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  Generate in seconds
                </p>
                <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
                  pulp generates melody, chords, bass, and drums simultaneously. Preview everything in the browser before you export.
                </p>
              </div>
              {/* Mini piano roll hint */}
              <div
                className="rounded-xl overflow-hidden mt-auto"
                style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px' }}
              >
                {[
                  { label: 'MEL', color: '#FF6D3F', bars: [1,0,1,1,0,1,0,1] },
                  { label: 'CHD', color: '#00B894', bars: [1,0,0,0,1,0,0,0] },
                  { label: 'BSS', color: '#6C63FF', bars: [1,1,0,1,1,1,0,1] },
                  { label: 'DRM', color: '#FF6D3F', bars: [1,0,1,0,1,0,1,0] },
                ].map(track => (
                  <div key={track.label} className="flex items-center gap-2 mb-1 last:mb-0">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: track.color, opacity: 0.7, width: 24, flexShrink: 0 }}>
                      {track.label}
                    </span>
                    <div className="flex items-end gap-px flex-1" style={{ height: 16 }}>
                      {track.bars.map((on, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: on ? '80%' : '20%',
                            background: track.color,
                            borderRadius: 2,
                            opacity: on ? 0.7 : 0.1,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 */}
            <div
              className="relative rounded-2xl p-8 flex flex-col gap-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 24,
                  fontSize: 80,
                  fontWeight: 800,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  color: 'var(--accent)',
                  opacity: 0.12,
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                3
              </span>
              <div style={{ color: 'var(--accent)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  Drop into your DAW
                </p>
                <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
                  Export .mid files and drag them directly into Ableton, Logic, FL Studio, or any DAW. Your MIDI, your rules.
                </p>
              </div>
              {/* DAW logos row */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {['Ableton', 'Logic Pro', 'FL Studio', 'Pro Tools'].map(daw => (
                  <span
                    key={daw}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.40)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {daw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      </>
      )}

      {/* ── GENERATOR ── */}
      <motion.section className={`${generatorOnly ? 'mt-20' : 'mt-24'} px-4 sm:px-8 py-24`} style={{ background: 'var(--bg)' }} {...scrollSection}>
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto mb-8 flex w-full max-w-[1040px] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[640px]">
              <p
                className="mb-3 text-[11px] uppercase tracking-[0.14em]"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}
              >
                Generator workspace
              </p>
              <h2
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  color: 'var(--text)',
                }}
              >
                Generate, audition, edit, and export without leaving the browser.
              </h2>
              <p
                className="mt-4 max-w-[560px] text-[15px] leading-relaxed"
                style={{ fontFamily: 'DM Sans, system-ui, sans-serif', color: 'var(--muted)' }}
              >
                Built to feel like a real music tool: prompt in, compare variations, shape layers, preview fast, and move into your DAW only when the idea is worth keeping.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Multi-track MIDI', 'Preview-first workflow', 'DAW-ready exports'].map((item) => (
                <span
                  key={item}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '7px 12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <motion.div id="generator" ref={toolRef} className="relative mx-auto w-full max-w-[1040px]">
            {genBar === 'loading' && (
              <div className="generator-progress-host rounded-t-xl overflow-hidden" aria-hidden>
                <div className="generator-progress-bar">
                  <div className="generator-progress-bar__fill" />
                </div>
              </div>
            )}
            {genBar === 'complete' && (
              <div className="generator-progress-host rounded-t-xl overflow-hidden" aria-hidden>
                <div className="generator-progress-bar generator-progress-bar--success">
                  <div className="generator-progress-bar__fill" />
                </div>
              </div>
            )}
            {genBar === 'error' && (
              <div className="generator-progress-host rounded-t-xl overflow-hidden" aria-hidden>
                <div className="generator-progress-bar generator-progress-bar--error">
                  <div className="generator-progress-bar__fill" />
                </div>
              </div>
            )}
            <div
              style={{
                background: 'var(--surface-strong)',
                border: '1px solid var(--border)',
                borderRadius: 24,
                boxShadow: 'var(--shadow-glass-elevated)',
                overflow: 'hidden',
              }}
            >
            <div
              className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: 'var(--accent)',
                    border: '1px solid rgba(255,109,63,0.24)',
                    background: 'rgba(255,109,63,0.08)',
                    borderRadius: 999,
                    padding: '6px 10px',
                  }}
                >
                  TEXT TO MIDI
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: 'var(--text-micro)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: 999,
                    padding: '6px 10px',
                  }}
                >
                  {GENRES[params.genre]?.name ?? 'Genre'} / {params.bpm} BPM / {params.key} {params.scale}
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: 'var(--muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Prompt, compare, layer, export
              </p>
            </div>
            <div className="px-4 py-5 sm:px-5 sm:py-6">

            {/* Prompt — primary Generate below */}
            <div
              ref={onboardingPromptRef}
              className="mb-4 hidden sm:block rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-micro)' }}>
                  PROMPT
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                  Describe genre, tempo, mood, or reference
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base select-none" style={{ color: 'var(--accent)' }}>✦</span>
                <input
                  id="main-prompt"
                  ref={promptRef}
                  type="text"
                  value={prompt}
                  readOnly={isGenerating}
                  onChange={e => { setPrompt(e.target.value); setActiveStyleTag(null); if (!promptHasTyped) setPromptHasTyped(true); if (e.target.value.trim().length > 0) setPromptCardsDismissed(false); }}
                  onFocus={() => setPromptFocused(true)}
                  onBlur={() => setPromptFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && effectiveIsSignedIn && void handleGenerate()}
                  placeholder="e.g. Deep house, 122 BPM, minor key"
                  className="input-field pr-16 w-full"
                  style={{ paddingLeft: 40, opacity: isGenerating ? 0.55 : 1, borderColor: promptFocused ? 'rgba(255,255,255,0.20)' : undefined, transition: 'border-color 200ms ease, opacity 150ms ease', outline: promptFocused ? 'none' : undefined }}
                  aria-busy={isGenerating}
                />
                {promptHasTyped && prompt.length > 0 && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: prompt.length > 260 ? '#F59E0B' : 'rgba(255,255,255,0.28)' }}
                  >
                    {prompt.length} / 280
                  </span>
                )}
              </div>

              {templatesOpen && !isGenerating && (
                <div className="mt-3">
                  <div
                    className="mb-2"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.50)' }}
                  >
                    Start with a template
                  </div>
                  <div className="md:overflow-x-auto overflow-x-hidden scrollbar-none">
                    <div className="flex flex-wrap md:flex-nowrap gap-2 pb-1">
                      {QUICK_START_TEMPLATES.map(t => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => runTemplate(t)}
                          className="shrink-0 rounded-xl px-3 py-2 text-left transition-all"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.01)';
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '';
                          }}
                        >
                          <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                            {t.name}
                          </div>
                          <div style={{ marginTop: 2, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.50)' }}>
                            {t.subtitle}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {!promptCardsDismissed && prompt.trim().length === 0 && !isGenerating && (
                  <motion.div
                    className="mt-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: EASE_UI }}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {[
                        'Tech House',
                        'Deep House',
                        'Afro House',
                        'Hip Hop',
                        'Trap',
                        'Lo-Fi',
                        'Pop',
                        'R&B',
                        'Drum & Bass',
                        'Ambient',
                      ].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className="group rounded-xl px-3 py-3 text-left transition-all"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.55)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                          }}
                          onClick={() => {
                            setPrompt(g);
                            setActiveStyleTag(null);
                            window.setTimeout(() => promptRef.current?.focus(), 0);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 8, height: 8, background: 'rgba(255,109,63,0.9)' }}
                              aria-hidden
                            />
                            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                              {g}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2">
                      {[
                        'Dark',
                        'Energetic',
                        'Chill',
                        'Melancholic',
                        'Euphoric',
                        'Groovy',
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="group rounded-xl px-3 py-3 text-left transition-all"
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.55)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                          }}
                          onClick={() => {
                            const base = (prompt ?? '').trim();
                            const next = base.length === 0 ? m : `${base} ${m}`;
                            setPrompt(next);
                            setActiveStyleTag(null);
                            window.setTimeout(() => promptRef.current?.focus(), 0);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-sm"
                              style={{ width: 10, height: 2, background: 'rgba(255,109,63,0.85)' }}
                              aria-hidden
                            />
                            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                              {m}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-2 flex items-center justify-between gap-4 px-1">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                  {effectiveIsSignedIn ? 'Press Enter to generate' : 'Sign in to generate below'}
                </span>
                <div className="flex items-center gap-4">
                  {!templatesOpen && variations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTemplatesOpen(true)}
                      className="text-left shrink-0"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: 'var(--foreground-muted)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                      }}
                    >
                      Templates
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInspire(v => !v)}
                    className="text-left shrink-0"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: 'var(--foreground-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    Inspire
                  </button>
                </div>
              </div>
            </div>
            <div
              className="sm:hidden flex flex-col gap-2 mb-4 rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-micro)' }}>
                  PROMPT
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                  Text to MIDI
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base select-none" style={{ color: 'var(--accent)' }}>✦</span>
                <input
                  type="text"
                  value={prompt}
                  readOnly={isGenerating}
                  onChange={e => { setPrompt(e.target.value); setActiveStyleTag(null); if (e.target.value.trim().length > 0) setPromptCardsDismissed(false); }}
                  onKeyDown={e => e.key === 'Enter' && effectiveIsSignedIn && void handleGenerate()}
                  placeholder="e.g. Deep house, 122 BPM, minor key"
                  className="input-field w-full"
                  style={{ paddingLeft: 40, opacity: isGenerating ? 0.55 : 1 }}
                  aria-busy={isGenerating}
                />
              </div>
              {templatesOpen && !isGenerating && (
                <div className="mt-3">
                  <div
                    className="mb-2"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.50)' }}
                  >
                    Start with a template
                  </div>
                  <div className="mobile-scroll-row">
                    <div className="row">
                      {QUICK_START_TEMPLATES.map(t => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => runTemplate(t)}
                          className="shrink-0 rounded-xl px-3 py-2 text-left transition-all"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.01)';
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '';
                          }}
                        >
                          <div style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                            {t.name}
                          </div>
                          <div style={{ marginTop: 2, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.50)' }}>
                            {t.subtitle}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <AnimatePresence>
                {!promptCardsDismissed && prompt.trim().length === 0 && !isGenerating && (
                  <motion.div
                    className="mt-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: EASE_UI }}
                  >
                    <div className="mobile-scroll-row">
                      <div className="row">
                      {[
                        'Tech House',
                        'Deep House',
                        'Afro House',
                        'Hip Hop',
                        'Trap',
                        'Lo-Fi',
                        'Pop',
                        'R&B',
                        'Drum & Bass',
                        'Ambient',
                      ].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className="group shrink-0 rounded-xl px-3 py-3 text-left transition-all"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            minWidth: 148,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.55)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                          }}
                          onClick={() => {
                            setPrompt(g);
                            setActiveStyleTag(null);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 8, height: 8, background: 'rgba(255,109,63,0.9)' }}
                              aria-hidden
                            />
                            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                              {g}
                            </span>
                          </div>
                        </button>
                      ))}
                      </div>
                    </div>

                    <div className="mt-2 mobile-scroll-row">
                      <div className="row">
                      {[
                        'Dark',
                        'Energetic',
                        'Chill',
                        'Melancholic',
                        'Euphoric',
                        'Groovy',
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="group shrink-0 rounded-xl px-3 py-3 text-left transition-all"
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            minWidth: 132,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,109,63,0.55)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                          }}
                          onClick={() => {
                            const base = (prompt ?? '').trim();
                            const next = base.length === 0 ? m : `${base} ${m}`;
                            setPrompt(next);
                            setActiveStyleTag(null);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-sm"
                              style={{ width: 10, height: 2, background: 'rgba(255,109,63,0.85)' }}
                              aria-hidden
                            />
                            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                              {m}
                            </span>
                          </div>
                        </button>
                      ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between gap-4 px-1">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                  {effectiveIsSignedIn ? 'Enter to generate' : 'Sign in to generate below'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowInspire(v => !v)}
                  className="text-left shrink-0"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Inspire
                </button>
              </div>
            </div>

            <div ref={generateBtnWrapRef} className="mb-4 flex justify-center">
              {effectiveIsSignedIn ? (
                <SpotlightButton
                  type="button"
                  className={`btn-primary btn-hero w-full${isGenerating ? ' pulsing' : ''}`}
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating ? <ButtonLoadingDots label="Generating" /> : 'Generate'}
                </SpotlightButton>
              ) : (
                <SignInButtonDeferred mode="modal">
                  <SpotlightButton type="button" className="btn-primary btn-hero w-full">
                    Generate
                  </SpotlightButton>
                </SignInButtonDeferred>
              )}
            </div>
            {!generationError && !isGenerating && variations.length === 0 && (
              <div
                className="mb-4 rounded-xl px-4 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.06em' }}>
                    READY
                  </span>
                  <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
                    Generates melody, chords, bass, and drums as editable MIDI layers.
                  </span>
                </div>
              </div>
            )}

            {generationError && (
              <div
                className="mb-4 rounded-xl p-4"
                role="alert"
                style={{ background: 'var(--surface)', border: '1px solid rgba(233,69,96,0.35)' }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#E94560', letterSpacing: '0.06em', marginBottom: 6 }}>
                      GENERATION STOPPED
                    </p>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                      {generationError}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {generationError.includes('Upgrade') ? (
                      <a
                        href="/pricing"
                        className="btn-primary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        Upgrade plan
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => { setGenerationError(null); setGenBar('idle'); void handleGenerate(); }}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => { setGenerationError(null); setGenBar('idle'); }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {effectiveIsSignedIn && (
              <div className="mb-4 flex justify-center">
                <div className="flex items-center gap-3">
                  <div className="relative inline-block">
                  <button
                    type="button"
                    className="rounded-xl border px-5 py-3 text-sm font-semibold transition-opacity"
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      borderColor: isStudio ? 'rgba(255,109,63,0.45)' : 'var(--border-weak)',
                      color: isStudio ? 'var(--text)' : 'var(--muted)',
                      background: isStudio ? 'rgba(255,109,63,0.08)' : 'transparent',
                      opacity: isStudio ? 1 : 0.75,
                      cursor: 'pointer',
                    }}
                    title={isStudio ? undefined : 'Upgrade to Studio to upload MIDI'}
                    onClick={() => {
                      if (!isStudio) {
                        setShowUpgradeModal(true);
                        return;
                      }
                      setShowMidiUploadModal(true);
                    }}
                  >
                    Upload MIDI
                  </button>
                  <span
                    className="pointer-events-none absolute -right-1 -top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Studio
                  </span>
                </div>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      className="rounded-xl border px-5 py-3 text-sm font-semibold transition-opacity"
                      style={{
                        fontFamily: 'DM Sans, sans-serif',
                        borderColor: isStudio ? 'rgba(255,109,63,0.40)' : 'var(--border-weak)',
                        color: isStudio ? 'var(--text)' : 'var(--muted)',
                        background: isStudio ? 'rgba(255,109,63,0.10)' : 'transparent',
                        opacity: isStudio ? 1 : 0.75,
                        cursor: 'pointer',
                      }}
                      title={isStudio ? undefined : 'Upgrade to Studio to convert audio to MIDI'}
                      onClick={() => {
                        if (!isStudio) {
                          setShowUpgradeModal(true);
                          return;
                        }
                        setShowAudioToMidiModal(true);
                      }}
                    >
                      Audio to MIDI
                    </button>
                    <span
                      className="pointer-events-none absolute -right-1 -top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Studio
                    </span>
                  </div>
                </div>
              </div>
            )}
            {!effectiveIsSignedIn && (
              <p className="-mt-2 mb-4 text-center" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                No card required · 20 generations per month
              </p>
            )}

            <AnimatePresence>
              {showInspire && (
                <motion.form
                  className="mb-4 rounded-xl p-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: EASE_UI }}
                  onSubmit={e => {
                    e.preventDefault();
                    void handleInspire();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={inspireText}
                      onChange={e => setInspireText(e.target.value)}
                      placeholder="e.g. Burial, Archangel"
                      className={`input-field${inspireFieldStatus === 'error' ? ' input-field--error' : ''}${inspireFieldStatus === 'success' ? ' input-field--success' : ''}`}
                      style={{ height: 40, paddingLeft: 14, paddingRight: 14 }}
                      disabled={isInspiring}
                      aria-invalid={inspireFieldStatus === 'error'}
                    />
                    <SpotlightButton
                      type="submit"
                      className="btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      disabled={isInspiring || !inspireText.trim()}
                    >
                      {isInspiring ? <ButtonLoadingDots label="Applying" /> : 'Apply'}
                    </SpotlightButton>
                  </div>
                  {inspireFieldStatus === 'error' && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                      Inspiration failed. Check your input and try again.
                    </p>
                  )}

                  {effectiveIsSignedIn && inspirationChips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {inspirationChips.slice(0, 5).map(chip => (
                        <button
                          key={chip}
                          type="button"
                          className="style-pill"
                          style={{
                            borderColor: 'rgba(255,109,63,0.45)',
                            color: 'var(--muted)',
                          }}
                          onClick={() => {
                            // Apply instantly without showing the input.
                            lastInspirationSourceRef.current = chip;
                            setInspireText(chip);
                            setShowInspire(false);
                            setInspirationChips(prev => {
                              const next = [chip, ...prev.filter(x => x !== chip)];
                              return next.slice(0, 5);
                            });
                            // Reuse Inspire handler logic by calling API directly with this chip.
                            // (Avoid relying on state timing.)
                            void (async () => {
                              setIsInspiring(true);
                              try {
                                const res = await fetch('/api/inspire', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ inspiration: chip }),
                                });
                                if (!res.ok) throw new Error('Failed to inspire');

                                const data = await res.json() as {
                                  genre?: string;
                                  bpm?: number;
                                  key?: string;
                                  scale?: string;
                                  mood?: string;
                                  styleTag?: string | null;
                                  promptSuggestion?: string;
                                };

                                const genreRaw = (data.genre ?? '').trim();
                                const genreKey =
                                  (genreRaw && GENRES[genreRaw]) ? genreRaw :
                                    GENRE_NAME_MAP[genreRaw] ??
                                    Object.entries(GENRES).find(([, g]) => g.name.toLowerCase() === genreRaw.toLowerCase())?.[0] ??
                                    params.genre;

                                const bpm = typeof data.bpm === 'number'
                                  ? Math.max(60, Math.min(180, Math.round(data.bpm)))
                                  : params.bpm;

                                const keyRaw = (data.key ?? '').trim().toUpperCase();
                                const key = (KEYS as readonly string[]).includes(keyRaw) ? keyRaw : params.key;

                                const scale = normalizeScaleToEngine(String(data.scale ?? params.scale));
                                const styleTag = (typeof data.styleTag === 'string' && data.styleTag.trim()) ? data.styleTag.trim() : null;
                                const promptSuggestion = (data.promptSuggestion ?? '').trim();

                                setParams(p => ({ ...p, genre: genreKey, bpm, key, scale }));
                                if (promptSuggestion) setPrompt(promptSuggestion);
                                setActiveStyleTag(styleTag && STYLE_TAGS[styleTag] ? styleTag : null);

                              toast.toast(`Loaded inspiration: ${chip}`, 'success');
                              } catch {
                                toast.toast('Inspire failed', 'danger');
                              } finally {
                                setIsInspiring(false);
                              }
                            })();
                          }}
                          title={chip}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

            {/* Credits indicator */}
            {credits !== null && !credits.isPro && (
              <p className="text-xs mb-3 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                <span style={{ color: credits.used >= credits.limit ? 'var(--accent)' : 'var(--muted)' }}>
                  {Math.max(0, credits.limit - credits.used)} / {credits.limit}
                </span>
                {' '}
                {effectiveIsSignedIn ? (
                  <>
                    generations remaining ·{' '}
                    <a href="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Upgrade to Pro</a>
                  </>
                ) : (
                  'guest generations left today'
                )}
              </p>
            )}

            {/* Style tags */}
            <div ref={styleTagsRef} className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
              {VIBES.map(vibe => {
                const isActive = activeStyleTag === vibe.tag;
                return (
                  <button
                    key={vibe.label}
                    onClick={() => handleStyleTag(vibe.tag)}
                    className="flex items-center justify-center flex-shrink-0 px-4 py-2 rounded-xl outline-none"
                    style={{
                      border: isActive ? `1px solid ${vibe.color}` : '1px solid var(--border)',
                      background: isActive ? `${vibe.color}18` : 'var(--surface)',
                      minWidth: 80,
                      transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: isActive ? vibe.color : 'var(--foreground-muted)',
                      letterSpacing: '0.04em',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {isActive ? '✓ ' : ''}{vibe.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {variations.length === 0 && !isGenerating && (
              <div
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                      OUTPUT PREVIEW
                    </span>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    Generate to unlock editor
                  </span>
                </div>

                {/* Fake piano rolls */}
                <div className="grid grid-cols-2 gap-3 p-4">
                  {[
                    { name: 'Melody', color: LAYER_VIZ_COLORS.melody },
                    { name: 'Chords', color: LAYER_VIZ_COLORS.chords },
                    { name: 'Bass', color: LAYER_VIZ_COLORS.bass },
                    { name: 'Drums', color: LAYER_VIZ_COLORS.drums },
                  ].map(layer => (
                    <div
                      key={layer.name}
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--border-weak)', background: 'var(--bg)', height: 64, position: 'relative' }}
                    >
                      {/* Layer label */}
                      <div className="absolute top-2 left-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: layer.color }} />
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: layer.color, opacity: 0.8 }}>
                          {layer.name.toUpperCase()}
                        </span>
                      </div>
                      {/* Fake notes as colored rectangles */}
                      <div className="absolute inset-0 flex items-center px-3 pt-6 gap-1">
                        {Array.from({ length: layer.name === 'Drums' ? 16 : 8 }, (_, i) => {
                          const show = layer.name === 'Melody' ? [0, 1, 3, 5, 6].includes(i) :
                            layer.name === 'Chords' ? [0, 2, 4, 6].includes(i) :
                              layer.name === 'Bass' ? [0, 1, 2, 4, 5, 6, 7].includes(i) :
                                i % 2 === 0;
                          return show ? (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                height: layer.name === 'Melody' ? `${30 + Math.sin(i * 1.5) * 20}%` :
                                  layer.name === 'Chords' ? '60%' :
                                    layer.name === 'Bass' ? '40%' : '70%',
                                background: layer.color,
                                borderRadius: 2,
                                opacity: 0.6 + (i % 3) * 0.15,
                                alignSelf: 'flex-end',
                              }}
                            />
                          ) : <div key={i} style={{ flex: 1 }} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overlay CTA */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--bg) 70%, transparent) 0%, transparent 100%)' }}
                >
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                    Results appear here as editable MIDI layers
                  </p>
                </div>
              </div>
            )}

            {/* Layer toggles */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {LAYERS.map(layer => (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  className={`layer-toggle ${params.layers[layer] ? 'on' : 'off'}`}
                  style={params.layers[layer] ? { color: LAYER_COLORS[layer] } : undefined}
                >
                  {layer.charAt(0).toUpperCase() + layer.slice(1)}
                </button>
              ))}
            </div>

            {variations.length === 0 && !isGenerating && (
              <HeroDemoPreview />
            )}

            {/* Manual controls */}
            <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowManual(!showManual)}
                className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                style={{ color: 'var(--text)', opacity: 0.6, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.opacity = '0.6'; }}
              >
                <span className="flex items-center gap-2"><span>⚙</span> Manual controls</span>
                <span className={`transform transition-transform text-xs ${showManual ? 'rotate-180' : ''}`}>▾</span>
              </button>

              <AnimatePresence>
                {showManual && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_UI }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-5 pb-5 pt-4 flex flex-col gap-4"
                      style={{ borderTop: '1px solid var(--border)' }}>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: 'var(--text)', opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>Genre</label>
                        <CustomSelect
                          className="w-full"
                          value={params.genre}
                          onChange={v => setParams(p => ({ ...p, genre: v }))}
                          options={GENRE_LIST.map(g => ({ label: g.name, value: g.key }))}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-2 text-xs uppercase tracking-wider"
                            style={{ color: 'var(--text)', opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>Key</label>
                          <CustomSelect
                            className="w-full"
                            value={params.key}
                            onChange={v => setParams(p => ({ ...p, key: v }))}
                            options={KEYS.map(k => ({ label: k, value: k }))}
                          />
                        </div>
                        <div>
                          <label className="block mb-2 text-xs uppercase tracking-wider"
                            style={{ color: 'var(--text)', opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>Scale</label>
                          <CustomSelect
                            className="w-full"
                            value={MANUAL_SCALE_OPTIONS.some(o => o.value === params.scale) ? params.scale : 'minor'}
                            onChange={v => setParams(p => ({ ...p, scale: v }))}
                            options={MANUAL_SCALE_OPTIONS}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs uppercase tracking-wider"
                            style={{ color: 'var(--text)', opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>Feel</label>
                          <span
                            className="text-xs tabular-nums"
                            style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            {params.humanization}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={params.humanization}
                          onChange={e =>
                            setParams(p => ({ ...p, humanization: parseInt(e.target.value, 10) }))
                          }
                          className="w-full"
                          aria-label="Humanization amount"
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="col-span-2 md:col-span-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs uppercase tracking-wider"
                            style={{ color: 'var(--text)', opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>BPM</label>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {detectedBpm !== null && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-md"
                                style={{
                                  fontFamily: 'JetBrains Mono, monospace',
                                  background: 'rgba(0,184,148,0.10)',
                                  border: '1px solid rgba(0,184,148,0.25)',
                                  color: '#00B894',
                                }}
                              >
                                Tap: {detectedBpm}
                              </span>
                            )}
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md"
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                background: 'rgba(255,109,63,0.10)',
                                border: '1px solid rgba(255,109,63,0.25)',
                                color: 'var(--muted)',
                              }}
                            >
                              {(variations.length > 0 ? variations[selectedVariation]?.params.key : null) ?? params.key}{' '}
                              {scaleLabel((variations.length > 0 ? variations[selectedVariation]?.params.scale : null) ?? params.scale)}
                            </span>
                            <div
                              className="flex items-center gap-1"
                              onMouseEnter={() => setBpmHovered(true)}
                              onMouseLeave={() => setBpmHovered(false)}
                            >
                              {bpmHovered && (
                                <button
                                  type="button"
                                  onClick={() => setParams(p => ({ ...p, bpm: Math.max(60, p.bpm - 1) }))}
                                  style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                >−</button>
                              )}
                              <span
                                className="text-xs font-semibold"
                                style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', minWidth: 28, textAlign: 'center' }}
                              >
                                {params.bpm}
                              </span>
                              {bpmHovered && (
                                <button
                                  type="button"
                                  onClick={() => setParams(p => ({ ...p, bpm: Math.min(200, p.bpm + 1) }))}
                                  style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                >+</button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="range"
                            min={60}
                            max={200}
                            value={params.bpm}
                            onChange={e => setParams(p => ({ ...p, bpm: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                          <button
                            type="button"
                            onClick={handleTapTempo}
                            className="h-9 px-3 rounded-lg text-xs transition-all"
                            style={{
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: 'var(--text)',
                              fontFamily: 'JetBrains Mono, monospace',
                              background: 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                            title="Tap to detect BPM"
                          >
                            Tap
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowBpmDetect(v => !v);
                              // open file picker immediately when enabling
                              if (!showBpmDetect) window.setTimeout(() => bpmFileInputRef.current?.click(), 0);
                            }}
                            className="h-9 px-3 rounded-lg text-xs transition-all"
                            style={{
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: 'var(--text)',
                              fontFamily: 'JetBrains Mono, monospace',
                              background: 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                            title="Detect BPM from an audio file"
                            disabled={isDetectingBpm}
                          >
                            Detect BPM
                          </button>
                        </div>
                        {showBpmDetect && (
                          <div className="mt-2">
                            <input
                              ref={bpmFileInputRef}
                              type="file"
                              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-wav"
                              onChange={e => void handleDetectBpmFile(e.target.files?.[0] ?? null)}
                              disabled={isDetectingBpm}
                              className="block w-full text-xs"
                              style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>Bars</label>
                        <CustomSelect
                          className="w-full"
                          value={String(params.bars)}
                          onChange={v => setParams(p => ({ ...p, bars: parseInt(v) }))}
                          options={[2, 4, 8].map(b => ({ label: `${b} bars`, value: String(b) }))}
                        />
                      </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Skeleton while generating */}
            <AnimatePresence>
              {isGenerating && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'var(--surface)', border: '1px solid rgba(255,109,63,0.28)' }}
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.06em', marginBottom: 6 }}>
                        BUILDING ARRANGEMENT
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text)', margin: 0 }}>
                        {generatingStage}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['4 layers', `${params.bars} bars`, `${params.bpm} BPM`].map(item => (
                        <span
                          key={item}
                          className="rounded-lg px-2.5 py-1"
                          style={{ border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                  >
                    {LAYERS.map(l => <SkeletonCard key={l} name={l} />)}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Variation selector — 3 cards side by side */}
            <AnimatePresence>
              {variations.length > 0 && !isGenerating && (
                <div className="mb-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      {!compareMode ? (
                        <SpotlightButton type="button" onClick={() => startCompare()} className="btn-secondary btn-sm">
                          Compare
                        </SpotlightButton>
                      ) : (
                        <SpotlightButton
                          type="button"
                          onClick={() => stopCompare({ stopAudio: true })}
                          className="btn-secondary btn-sm"
                          style={{ borderColor: 'rgba(255,109,63,0.45)' }}
                        >
                          ■ Stop
                        </SpotlightButton>
                      )}
                      {compareMode && (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                          Comparing variations… <span style={{ color: 'var(--accent)' }}>V{compareIndex + 1}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.div
                    className="flex flex-col sm:flex-row gap-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {variations.map((v, i) => (
                      <VariationCard
                        key={i}
                        label={`V${i + 1}`}
                        result={v.result}
                        variationParams={v.params}
                        selected={selectedVariation === i}
                        isPlaying={playingVariationIndex === i}
                        compareHighlight={compareMode && compareIndex === i}
                        isPublic={variationPublic[i] ?? false}
                        onTogglePublic={variationIds[i] ? e => { e.stopPropagation(); void handleTogglePublic(i, !(variationPublic[i] ?? false)); } : undefined}
                        onSelect={() => {
                          if (compareMode) {
                            // Lock to clicked variation and stop comparing.
                            stopCompare();
                            setCompareIndex(i);
                            setSelectedVariation(i);
                            startVariationPlayback(i);
                            return;
                          }
                          stopAllAppAudio();
                          setPlayingVariationIndex(null);
                          setPlayingAll(false);
                          setSelectedVariation(i);
                        }}
                        onPlayToggle={e => {
                          e.stopPropagation();
                          if (compareMode) stopCompare();
                          if (playingVariationIndex === i) {
                            stopAllAppAudio();
                            setPlayingVariationIndex(null);
                          } else {
                            startVariationPlayback(i);
                          }
                        }}
                        onExtend={() => {
                          if (selectedVariation !== i) return;
                          void handleExtendSelected();
                        }}
                        onDownload={e => {
                          e.stopPropagation();
                          track('midi_downloaded', { genre: v.params.genre, layer: 'full' });
                          const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
                          if (v.result.melody.length > 0) tracks.push({ name: 'Melody', notes: v.result.melody, channel: 0 });
                          if (v.result.chords.length > 0) tracks.push({ name: 'Chords', notes: v.result.chords, channel: 1 });
                          if (v.result.bass.length   > 0) tracks.push({ name: 'Bass',   notes: v.result.bass,   channel: 2 });
                          if (v.result.drums.length  > 0) tracks.push({ name: 'Drums',  notes: v.result.drums,  channel: 9 });
                          const midi = generateMidiFormat1(tracks, v.params.bpm);
                          const genre = GENRES[v.params.genre]?.name || 'track';
                          downloadMidi(midi, `pulp-v${i + 1}-${genre.toLowerCase().replace(/\\s/g, '-')}-${v.params.key}${v.params.scale}.mid`);
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Result action bar */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  ref={onboardingExportRef}
                  className="result-action-bar mb-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_UI }}
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 4 }}>
                        SELECTED TAKE V{selectedVariation + 1}
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                        {GENRES[variations[selectedVariation]?.params.genre ?? params.genre]?.name || 'Generated track'} - {variations[selectedVariation]?.params.bpm ?? params.bpm} BPM - {variations[selectedVariation]?.params.key ?? params.key} {variations[selectedVariation]?.params.scale ?? params.scale}
                      </p>
                    </div>
                    <span className="rounded-lg px-2.5 py-1" style={{ border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                      Drag MIDI into DAW
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  <SpotlightButton onClick={handlePlayAll} className="btn-secondary btn-sm">
                    {playingAll ? '■  Stop' : '▶  Play All'}
                  </SpotlightButton>
                  <div
                    draggable
                    onDragStart={(e) => {
                      const sel = variations[selectedVariation];
                      if (!sel) return;
                      const tracks = [
                        { name: 'Melody', notes: sel.result.melody, channel: 0 },
                        { name: 'Chords', notes: sel.result.chords, channel: 1 },
                        { name: 'Bass', notes: sel.result.bass, channel: 2 },
                        { name: 'Drums', notes: sel.result.drums, channel: 9 },
                      ].filter(t => t.notes.length > 0);
                      const midi = generateMidiFormat1(tracks, sel.params.bpm);
                      const ab = new ArrayBuffer(midi.byteLength);
                      new Uint8Array(ab).set(midi);
                      const blob = new Blob([ab], { type: 'audio/midi' });
                      const genre = GENRES[sel.params.genre]?.name || 'track';
                      const file = new File([blob], `pulp-${genre.toLowerCase().replace(/\s/g,'-')}.mid`, { type: 'audio/midi' });
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.items.add(file);
                    }}
                    title="Drag directly into your DAW"
                  >
                    <div className="relative inline-flex">
                      <SpotlightButton onClick={handleDownloadAll} className="btn-download btn-sm">
                        {exportFlash === 'midi' ? '✓  Downloaded' : '↓  Download MIDI'}
                      </SpotlightButton>
                      <button
                        type="button"
                        className="btn-download btn-sm tip"
                        aria-label="Download options"
                        data-tip="Download individual layers"
                        style={{
                          marginLeft: 8,
                          minWidth: 44,
                          paddingLeft: 0,
                          paddingRight: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setShowDownloadMenu(v => !v);
                        }}
                      >
                        ▾
                      </button>

                      <AnimatePresence>
                        {showDownloadMenu && (
                          <>
                            <motion.div
                              className="fixed inset-0 z-[90]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setShowDownloadMenu(false)}
                              aria-hidden
                            />
                            <motion.div
                              className="absolute right-0 top-[calc(100%+8px)] z-[91] w-[220px] overflow-hidden rounded-xl"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.16, ease: EASE_UI }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="w-full px-4 py-3 text-left text-sm transition-colors"
                                style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)' }}
                                onClick={() => {
                                  setShowDownloadMenu(false);
                                  handleDownloadAll();
                                }}
                              >
                                All tracks
                              </button>
                              <div style={{ height: 1, background: 'var(--border)' }} />
                              {([
                                { k: 'melody' as const, label: 'Melody' },
                                { k: 'chords' as const, label: 'Chords' },
                                { k: 'bass' as const, label: 'Bass' },
                                { k: 'drums' as const, label: 'Drums' },
                              ]).map(opt => (
                                <button
                                  key={opt.k}
                                  type="button"
                                  className="w-full px-4 py-3 text-left text-sm transition-colors"
                                  style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)' }}
                                  onClick={() => {
                                    setShowDownloadMenu(false);
                                    handleDownloadTrackOnly(opt.k);
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <SpotlightButton onClick={() => void handleExportAbleton()} className="btn-download btn-sm">
                    {exportFlash === 'ableton' ? '✓  Exported' : '↓  Export to Ableton'}
                  </SpotlightButton>
                  <SpotlightButton
                    type="button"
                    onClick={() => void handleDownloadWav()}
                    className="btn-download btn-sm tip"
                    data-tip="Render and download WAV"
                    disabled={isRenderingWav}
                  >
                    {isRenderingWav ? <ButtonLoadingDots label="Rendering WAV" /> : exportFlash === 'wav' ? '✓  Exported' : '↓  Download WAV'}
                  </SpotlightButton>
                  <SpotlightButton
                    type="button"
                    onClick={handleShare}
                    className="btn-secondary btn-sm copy-label-stack tip"
                    data-tip="Copy shareable link"
                    data-copied={shareCopied ? 'true' : 'false'}
                    disabled={!variationIds[selectedVariation]}
                  >
                    <span className="copy-label-stack__a">⧉  Share</span>
                    <span className="copy-label-stack__b">Copied</span>
                  </SpotlightButton>
                  <SpotlightButton
                    type="button"
                    onClick={() => {
                      if (!isStudio) {
                        setShowUpgradeModal(true);
                        return;
                      }
                      setShowAudioToMidiModal(true);
                    }}
                    className="btn-secondary btn-sm"
                    style={isStudio ? { borderColor: 'rgba(255,109,63,0.30)', color: 'var(--text)' } : undefined}
                    title={isStudio ? 'Convert audio to editable MIDI (Studio)' : 'Available on Studio plan'}
                  >
                    Audio to MIDI
                  </SpotlightButton>
                  <SpotlightButton
                    onClick={handleCreateCollab}
                    className="btn-secondary btn-sm copy-label-stack"
                    data-copied={collabCopied ? 'true' : 'false'}
                  >
                    <span className="copy-label-stack__a">Collab</span>
                    <span className="copy-label-stack__b">Copied</span>
                  </SpotlightButton>
                  <SpotlightButton onClick={handleDownloadMusicXml} className="btn-secondary btn-sm">
                    ↓  Download MusicXML
                  </SpotlightButton>
                  <SpotlightButton onClick={handleDownloadJson} className="btn-secondary btn-sm">
                    ↓  Download JSON
                  </SpotlightButton>
                  <SpotlightButton onClick={() => void handleGenerate()} className="btn-secondary btn-sm" disabled={isGenerating}>
                    ↻  Regenerate
                  </SpotlightButton>
                  <SpotlightButton
                    onClick={() => void handleFindSimilar()}
                    className="btn-secondary btn-sm tip"
                    data-tip="Same genre, key & vibe — fresh patterns"
                    disabled={isFindingSimilar || isGenerating}
                  >
                    {isFindingSimilar
                      ? <ButtonLoadingDots label="Finding" />
                      : (
                        <span className="flex items-center gap-1.5">
                          <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                            <circle cx="4.5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                            <circle cx="8.5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                          </svg>
                          Find Similar
                        </span>
                      )
                    }
                  </SpotlightButton>
                  {variationIds[selectedVariation] && (
                    <SpotlightButton onClick={() => setShowEmbedModal(true)} className="btn-secondary btn-sm">
                      Embed
                    </SpotlightButton>
                  )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Audio → MIDI is now a Studio modal next to Upload MIDI */}

            {/* Humanize control */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  className="mb-5 flex items-center gap-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_UI }}
                >
                  {/* Waveform icon */}
                  <svg width="15" height="12" viewBox="0 0 15 12" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                    <path d="M1 6h1.5M13.5 6H15M3.5 6V3.5M5 6V1.5M6.5 6V4M8 6V2M9.5 6V4.5M11 6V3.5M12.5 6V5"
                      stroke="#FF6D3F" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <label
                    htmlFor="humanize-slider"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: 'var(--text)',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      cursor: 'default',
                    }}
                  >
                    Humanize{' '}
                    <span style={{ color: 'var(--accent)', minWidth: 24, display: 'inline-block' }}>
                      {humanize}
                    </span>
                  </label>
                  <input
                    id="humanize-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={humanize}
                    onChange={e => setHumanize(Number(e.target.value))}
                    style={{
                      width: 160,
                      flexShrink: 0,
                      background: `linear-gradient(to right, #FF6D3F ${humanize}%, var(--border) ${humanize}%)`,
                    }}
                  />
                  {humanize === 0 && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      quantized
                    </span>
                  )}
                  {humanize >= 80 && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      max feel
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chord progression (prominent) */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  key={`chords-${variationIds[selectedVariation] ?? 'local'}-${selectedVariation}-${variations[selectedVariation]?.params.bpm ?? params.bpm}`}
                  className="mb-5"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: EASE_UI }}
                >
                  <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p
                      className="leading-tight"
                      style={{
                        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                        fontWeight: 700,
                        fontSize: 26,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        backgroundImage: 'linear-gradient(90deg, rgba(255,109,63,0.95) 0%, rgba(255,109,63,0.35) 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      {deriveChordProgression(
                        result.chords,
                        variations[selectedVariation]?.params.bars ?? params.bars
                      ).join(' → ')}
                    </p>
                    <p
                      className="mt-2 text-xs"
                      style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.50)' }}
                    >
                      {(variations[selectedVariation]?.params.key ?? params.key)} {(variations[selectedVariation]?.params.scale ?? params.scale)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Layer result cards for selected variation */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  ref={layerCardsRef}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {LAYERS.map(layer =>
                    params.layers[layer] && result[layer].length > 0 && (
                      <LayerCard
                        key={layer}
                        name={layer}
                        notes={result[layer]}
                        bpm={variations[selectedVariation]?.params.bpm ?? params.bpm}
                        genre={params.genre}
                        enabled={params.layers[layer]}
                        onRegenerate={() => handleRegenerateLayer(layer)}
                        onDownload={() => handleDownloadLayer(layer, result[layer])}
                        instrument={layerInstruments[layer]}
                        onInstrumentChange={v => setLayerInstruments(prev => ({ ...prev, [layer]: v }))}
                        fxOpen={openFXLayer === layer}
                        onFXToggle={() => handleToggleFXPanel(layer)}
                        onFXChange={fx => handleLayerFXChange(layer, fx)}
                        volume={mixerUI[layer as keyof AllMixerState].volume}
                        muted={mixerUI[layer as keyof AllMixerState].muted}
                        soloed={mixerUI[layer as keyof AllMixerState].soloed}
                        onVolumeChange={v => handleMixerChange(layer as keyof AllMixerState, { volume: v })}
                        onMuteToggle={() => handleMixerChange(layer as keyof AllMixerState, { muted: !mixerUI[layer as keyof AllMixerState].muted })}
                        onSoloToggle={() => handleMixerChange(layer as keyof AllMixerState, { soloed: !mixerUI[layer as keyof AllMixerState].soloed })}
                        reversed={reversedLayers[layer] ?? false}
                        onReverse={() => handleReverseLayer(layer as typeof LAYERS[number])}
                      />
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Match Sounds button */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={() => setMatchSoundsPanelOpen(true)}
                    className="inline-flex items-center gap-2 text-sm transition-all"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,109,63,0.35)',
                      background: 'rgba(255,109,63,0.08)',
                      color: '#FF6D3F',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,109,63,0.6)'; e.currentTarget.style.background = 'rgba(255,109,63,0.14)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,109,63,0.35)'; e.currentTarget.style.background = 'rgba(255,109,63,0.08)'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                      <path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M2.93 2.93l1.41 1.41M8.66 8.66l1.41 1.41M2.93 10.07l1.41-1.41M8.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Match Sounds
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generation metadata */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
                  className="mt-4 flex flex-wrap gap-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  {[GENRES[params.genre]?.name, `${params.key} ${params.scale}`, `${variations[selectedVariation]?.params.bpm ?? params.bpm} BPM`, `${params.bars} bars`]
                    .filter(Boolean)
                    .map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-md text-xs"
                        style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        {tag}
                      </span>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Piano Roll Editor */}
            <AnimatePresence>
              {variations.length > 0 && !isGenerating && (
                <>
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_UI }}
                  style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
                >
                  {/* Header: label + layer tabs */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
                  >
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: 'var(--text-micro)',
                        letterSpacing: '0.06em',
                        flexShrink: 0,
                      }}
                    >
                      EDITOR
                    </span>

                    <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
                      <div className="flex items-center gap-2 pr-1" style={{ whiteSpace: 'nowrap' }}>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditorView('piano')}
                            className="rounded-md transition-all"
                            style={{
                              padding: '8px 12px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              color: editorView === 'piano' ? 'var(--accent)' : 'var(--muted)',
                              background: editorView === 'piano' ? 'rgba(255,109,63,0.14)' : 'transparent',
                              border: editorView === 'piano' ? '1px solid rgba(255,109,63,0.45)' : '1px solid transparent',
                            }}
                          >
                            Piano Roll
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorView('sheet')}
                            className="rounded-md transition-all"
                            style={{
                              padding: '8px 12px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              color: editorView === 'sheet' ? 'var(--accent)' : 'var(--muted)',
                              background: editorView === 'sheet' ? 'rgba(255,109,63,0.14)' : 'transparent',
                              border: editorView === 'sheet' ? '1px solid rgba(255,109,63,0.45)' : '1px solid transparent',
                            }}
                          >
                            Sheet Music
                          </button>
                          {editorLayer === 'drums' && editorView === 'piano' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setDrumsEditorView('piano')}
                                className="rounded-md transition-all"
                                style={{
                                  padding: '8px 12px',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontSize: 11,
                                  lineHeight: 1,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  color: drumsEditorView === 'piano' ? 'var(--accent)' : 'var(--muted)',
                                  background: drumsEditorView === 'piano' ? 'rgba(255,109,63,0.14)' : 'transparent',
                                  border: drumsEditorView === 'piano' ? '1px solid rgba(255,109,63,0.45)' : '1px solid transparent',
                                }}
                              >
                                Piano Roll
                              </button>
                              <button
                                type="button"
                                onClick={() => setDrumsEditorView('step')}
                                className="rounded-md transition-all"
                                style={{
                                  padding: '8px 12px',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontSize: 11,
                                  lineHeight: 1,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  color: drumsEditorView === 'step' ? 'var(--accent)' : 'var(--muted)',
                                  background: drumsEditorView === 'step' ? 'rgba(255,109,63,0.14)' : 'transparent',
                                  border: drumsEditorView === 'step' ? '1px solid rgba(255,109,63,0.45)' : '1px solid transparent',
                                }}
                              >
                                Step Seq
                              </button>
                            </>
                          )}
                        </div>

                        <div className="h-6 w-px flex-shrink-0" style={{ background: 'var(--divider)' }} aria-hidden />

                        {editorView === 'piano' && (
                          <button
                            type="button"
                            className="rounded-md transition-all"
                            style={{
                              padding: '8px 12px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              color: 'var(--text)',
                              border: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            onClick={handleCompletePattern}
                            title="Generate 8 bars continuing your pattern"
                          >
                            Complete Pattern
                          </button>
                        )}
                        {editorView === 'sheet' && (
                          <button
                            type="button"
                            className="rounded-md transition-all"
                            style={{
                              padding: '8px 12px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              color: 'var(--text)',
                              border: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            onClick={() => {
                              const c = sheetCanvasRef.current;
                              if (!c) return;
                              const url = c.toDataURL('image/png');
                              const w = window.open('', '_blank');
                              if (!w) return;
                              w.document.write(`<!doctype html><html><head><title>Print Sheet</title></head><body style="margin:0;background:#0A0A0B;display:flex;align-items:center;justify-content:center;"><img src="${url}" style="max-width:100%;height:auto;" /></body></html>`);
                              w.document.close();
                              w.focus();
                              w.print();
                            }}
                          >
                            Print
                          </button>
                        )}
                        {editorView === 'piano' && (
                          <button
                            type="button"
                            className="rounded-md transition-all"
                            style={{
                              padding: '8px 12px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              color: 'var(--text)',
                              border: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            onClick={() => setIsPianoFullscreen(true)}
                            title="Fullscreen (F)"
                          >
                            ⤢
                          </button>
                        )}

                        <div className="h-6 w-px flex-shrink-0" style={{ background: 'var(--divider)' }} aria-hidden />

                        <div className="flex gap-2 flex-shrink-0">
                          {EDITOR_LAYERS.map(layer => (
                            <button
                              key={layer}
                              onClick={() => setEditorLayer(layer)}
                              className="rounded-md capitalize transition-all"
                              style={{
                                padding: '8px 12px',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11,
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                color: editorLayer === layer ? LAYER_COLORS[layer] : 'var(--muted)',
                                background: editorLayer === layer ? 'var(--surface-weak)' : 'transparent',
                                border: editorLayer === layer ? '1px solid var(--border)' : '1px solid transparent',
                              }}
                            >
                              {layer === 'imported' ? 'imported' : layer}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Canvas */}
                  {editorView === 'piano' && editorLayer === 'drums' && drumsEditorView === 'step' ? (
                    <div ref={onboardingPianoRef} style={{ padding: 12 }}>
                      <StepSequencer
                        key={`step-${selectedVariation}`}
                        notes={result?.drums ?? []}
                        bars={variations[selectedVariation]?.params.bars ?? params.bars}
                        isPlaying={playingVariationIndex === selectedVariation}
                        playheadBeat={editorPlayheadBeat}
                        onNotesChange={newNotes => handleEditorNotesChange('drums', newNotes)}
                      />
                    </div>
                  ) : editorView === 'piano' ? (
                    <div ref={onboardingPianoRef}>
                      <PianoRollEditor
                        key={`${selectedVariation}-${editorLayer}`}
                        notes={editorLayer === 'imported' ? importedNotes : (result?.[editorLayer] ?? [])}
                        color={LAYER_COLORS[editorLayer] ?? DS.accent}
                        bars={variations[selectedVariation]?.params.bars ?? params.bars}
                        layerName={editorLayer === 'imported' ? 'imported' : editorLayer}
                        isPlaying={playingVariationIndex === selectedVariation}
                        playheadBeat={editorPlayheadBeat}
                        gridHeightPx={isPianoFullscreen ? Math.max(360, viewportH - 310) : undefined}
                        velocityHeightPx={isPianoFullscreen ? 120 : undefined}
                        chordOverlayNotes={[
                          ...(variations[selectedVariation]?.result.melody ?? []),
                          ...(variations[selectedVariation]?.result.chords ?? []),
                          ...(variations[selectedVariation]?.result.bass ?? []),
                          ...(variations[selectedVariation]?.result.drums ?? []),
                          ...(importedNotes ?? []),
                        ]}
                        chordStripVisible={pianoChordStripVisible}
                        onChordStripVisibleChange={setPianoChordStripVisible}
                        bpm={variations[selectedVariation]?.params.bpm ?? params.bpm}
                        onExportChopAll={handleExportChopAll}
                        onNotesChange={newNotes => {
                          if (editorLayer === 'imported') setImportedNotes(newNotes);
                          else handleEditorNotesChange(editorLayer, newNotes);
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: 12, background: 'var(--bg)' }}>
                      <canvas
                        ref={sheetCanvasRef}
                        style={{ width: '100%', height: 320, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}
                      />
                    </div>
                  )}
                </motion.div>
                <AnimatePresence>
                  {isPianoFullscreen && editorView === 'piano' && (
                    <>
                      <motion.div
                        className="fixed inset-0 z-[120]"
                        style={{ background: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => setIsPianoFullscreen(false)}
                        aria-hidden
                      />
                      <motion.div
                        className="fixed inset-0 z-[121] p-4"
                        initial={{ opacity: 0, scale: 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.985 }}
                        transition={{ duration: 0.18, ease: EASE_UI }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div
                          className="h-full w-full overflow-hidden rounded-2xl"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                        >
                          <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
                          >
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.06em' }}>
                                PIANO ROLL — FULLSCREEN
                              </span>
                            </div>
                            <button
                              type="button"
                              className="px-3 h-7 rounded-md transition-all"
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11,
                                color: 'var(--text)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'transparent',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                              onClick={() => setIsPianoFullscreen(false)}
                              title="Exit fullscreen (Esc)"
                            >
                              ×
                            </button>
                          </div>
                          <div style={{ height: 'calc(100% - 44px)' }}>
                            <PianoRollEditor
                              key={`fs-${selectedVariation}-${editorLayer}`}
                              notes={editorLayer === 'imported' ? importedNotes : (result?.[editorLayer] ?? [])}
                              color={LAYER_COLORS[editorLayer] ?? DS.accent}
                              bars={variations[selectedVariation]?.params.bars ?? params.bars}
                              layerName={editorLayer === 'imported' ? 'imported' : editorLayer}
                              isPlaying={playingVariationIndex === selectedVariation}
                              playheadBeat={editorPlayheadBeat}
                              gridHeightPx={Math.max(420, viewportH - 220)}
                              velocityHeightPx={140}
                              chordOverlayNotes={[
                                ...(variations[selectedVariation]?.result.melody ?? []),
                                ...(variations[selectedVariation]?.result.chords ?? []),
                                ...(variations[selectedVariation]?.result.bass ?? []),
                                ...(variations[selectedVariation]?.result.drums ?? []),
                                ...(importedNotes ?? []),
                              ]}
                              chordStripVisible={pianoChordStripVisible}
                              onChordStripVisibleChange={setPianoChordStripVisible}
                              bpm={variations[selectedVariation]?.params.bpm ?? params.bpm}
                              onExportChopAll={handleExportChopAll}
                              onNotesChange={newNotes => {
                                if (editorLayer === 'imported') setImportedNotes(newNotes);
                                else handleEditorNotesChange(editorLayer, newNotes);
                              }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                </>
              )}
            </AnimatePresence>
            </div>
            </div>
          </motion.div>

          {/* Utility footer */}
          <div
            className="mx-auto mt-10 flex max-w-[1040px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--foreground-muted)', letterSpacing: '0.04em' }}>
              20+ genre models / drag-to-DAW / melody, chords, bass and drums / MIDI and WAV export
            </p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-micro)' }}>
              G generate / ? shortcuts / Cmd+K commands
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── COMPARISON ── */}
      {!generatorOnly && (
      <>
      <motion.section ref={compareRef} className="mt-20 px-4 sm:px-8 py-20" style={{ background: 'var(--bg)' }} {...scrollSection}>
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10">
            <h2
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 3.2vw, 2rem)',
                lineHeight: 1.15,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
              }}
            >
              How pulp compares
            </h2>
          </div>

          {(() => {
            const cols = ['pulp', 'Staccato', 'AIVA', 'HookPad'] as const;
            const rows: { label: string; values: [string, string, string, string] }[] = [
              { label: 'Price', values: ['$7/mo', '$9.99/mo', '$15/mo', '$7.99/mo'] },
              { label: 'Mix Engine', values: ['Built-in', '—', '—', '—'] },
              { label: 'Artist Mapping', values: ['✓', 'Limited', '—', '—'] },
              { label: 'MIDI + WAV Export', values: ['✓', '✓', '✓', '✓'] },
              { label: 'Piano Roll Editor', values: ['✓', '—', '—', '✓'] },
              { label: 'Web-based (no install)', values: ['✓', '✓', '✓', '✓'] },
              { label: 'Audio to MIDI', values: ['✓', '—', '—', '—'] },
            ];

            const labelStyle: React.CSSProperties = {
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontSize: 14,
              color: 'var(--muted)',
              letterSpacing: 'normal',
              fontWeight: 500,
            };

            const valueStyle = (v: string): React.CSSProperties => ({
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
              color: v === '—' ? 'var(--text-micro)' : 'var(--text)',
            });

            return (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--divider)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                <div className="compare-scroll">
                  <div className="compare-table">
                    {/* Header row */}
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: 'minmax(140px, 1.1fr) repeat(4, minmax(140px, 1fr))',
                        borderBottom: '1px solid var(--divider)',
                      }}
                    >
                      <div className="compare-cell compare-label" style={{ padding: '16px 18px' }} />
                      {cols.map((c, idx) => (
                        <div
                          key={c}
                          className={idx === 0 ? 'compare-cell compare-pulp' : 'compare-cell'}
                          style={{
                            padding: '16px 18px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: idx === 0 ? 'var(--text)' : 'var(--muted)',
                            background: idx === 0 ? 'var(--surface-weak)' : 'transparent',
                          }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>

                    {/* Data rows */}
                    {rows.map((r, ri) => (
                      <motion.div
                        key={r.label}
                        className="grid"
                        style={{
                          gridTemplateColumns: 'minmax(140px, 1.1fr) repeat(4, minmax(140px, 1fr))',
                          borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--divider)',
                          opacity: prefersReducedMotion
                            ? 1
                            : (ri === 0 ? cmpRow0O : ri === 1 ? cmpRow1O : ri === 2 ? cmpRow2O : ri === 3 ? cmpRow3O : ri === 4 ? cmpRow4O : ri === 5 ? cmpRow5O : cmpRow6O),
                          y: prefersReducedMotion
                            ? 0
                            : (ri === 0 ? cmpRow0Y : ri === 1 ? cmpRow1Y : ri === 2 ? cmpRow2Y : ri === 3 ? cmpRow3Y : ri === 4 ? cmpRow4Y : ri === 5 ? cmpRow5Y : cmpRow6Y),
                        }}
                      >
                        <div className="compare-cell compare-label" style={{ padding: '14px 18px', ...labelStyle }}>{r.label}</div>
                        {r.values.map((v, ci) => (
                          <div
                            key={`${r.label}-${ci}`}
                            className={ci === 0 ? 'compare-cell compare-pulp' : 'compare-cell'}
                            style={{
                              padding: '14px 18px',
                              background: ci === 0 ? 'var(--surface-weak)' : 'transparent',
                            }}
                          >
                            <motion.span
                              style={{
                                ...valueStyle(v),
                                display: 'inline-block',
                                opacity: prefersReducedMotion
                                  ? 1
                                  : (ci === 0
                                      ? (ri === 0 ? cmpPulp0O : ri === 1 ? cmpPulp1O : ri === 2 ? cmpPulp2O : ri === 3 ? cmpPulp3O : ri === 4 ? cmpPulp4O : ri === 5 ? cmpPulp5O : cmpPulp6O)
                                      : (ri === 0 ? cmpOther0O : ri === 1 ? cmpOther1O : ri === 2 ? cmpOther2O : ri === 3 ? cmpOther3O : ri === 4 ? cmpOther4O : ri === 5 ? cmpOther5O : cmpOther6O)),
                              }}
                            >
                              {v}
                            </motion.span>
                          </div>
                        ))}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
            All plans include features others charge extra for.
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,0.30)',
              opacity: 0.7,
            }}
          >
            Pricing and features based on publicly available information as of April 2026. Subject to change.
          </div>
        </div>
      </motion.section>

      <SiteFooter />
      </>
      )}
      </main>

      {matchSoundsPanelOpen && (
        <MatchSoundsPanel
          genre={params.genre}
          onClose={() => setMatchSoundsPanelOpen(false)}
        />
      )}
    </>
  );
}




