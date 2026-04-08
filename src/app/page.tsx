'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import {
  generateTrack, getDefaultParams, GENRES, STYLE_TAGS, parsePrompt, MANUAL_SCALE_OPTIONS, SCALE_INTERVALS,
  type GenerationParams, type GenerationResult, type NoteEvent,
} from '@/lib/music-engine';
import { generateMidiFormat0, generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';
import { playNotes, playLayer, stopAllPlayback } from '@/lib/audio-engine';
import { supabase } from '@/lib/supabase';
import { track } from '@vercel/analytics';
import { Skeleton, SkeletonText } from '@/components/Skeleton';
import { useToast } from '@/components/toast/useToast';
import { generateAbletonAlsBlob } from '@/lib/ableton-export';
import { Navbar } from '@/components/Navbar';

// ─── MOTION VARIANTS ─────────────────────────────────────────
const EASE_OUT = [0, 0, 0.2, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

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

// ─── ONBOARDING TOOLTIP ───────────────────────────────────────
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
          borderRadius: 14,
          border: '1px solid rgba(255,109,63,0.55)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
        }}
      />

      <motion.div
        className="fixed z-[96]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          left,
          top,
          width: maxW,
          background: '#111118',
          border: '1px solid #1A1A2E',
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
            background: '#111118',
            borderLeft: '1px solid #1A1A2E',
            borderTop: '1px solid #1A1A2E',
            transform: 'translateX(-50%) rotate(45deg)',
            top: arrowTop,
            bottom: arrowBottom,
          }}
        />

        <div className="flex items-center justify-between gap-4 mb-2">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(138,138,154,0.55)', letterSpacing: '0.08em' }}>
            {stepLabel}
          </span>
          <button
            onClick={onSkip}
            className="text-xs transition-colors"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.6)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F0FF')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(138,138,154,0.6)')}
          >
            Skip
          </button>
        </div>

        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#F0F0FF' }}>
          {title}
        </p>
        <p className="mt-2" style={{ color: '#8A8A9A', fontSize: 13, lineHeight: 1.6 }}>
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
              color: '#FF6D3F',
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,109,63,0.25)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
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

function SpotlightButton({ children, style, ...rest }: SpotlightButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, show: false });

  return (
    <button
      ref={ref}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
      onMouseMove={e => {
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

    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

    for (const note of notes) {
      const x = (note.startTime / maxTime) * w;
      const noteW = Math.max(2, (note.duration / maxTime) * w);
      const y = h - ((note.pitch - minPitch) / pitchRange) * h;
      const noteH = Math.max(2, (h / pitchRange) * 0.8);

      ctx.fillStyle = color;
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
  }, [notes, color, height]);

  return (
    <canvas ref={canvasRef} className="w-full rounded-md piano-roll" style={{ height }} />
  );
}

// ─── LAYER COLORS ─────────────────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  melody: '#FF6D3F',
  chords: '#A78BFA',
  bass:   '#00B894',
  drums:  '#E94560',
  imported: '#A78BFA',
};

const LAYERS = ['melody', 'chords', 'bass', 'drums'] as const;
const EDITOR_LAYERS = [...LAYERS, 'imported'] as const;

// ─── PIANO ROLL EDITOR CONSTANTS ──────────────────────────────
const EDITOR_MIDI_MIN = 36;   // C2
const EDITOR_MIDI_MAX = 84;   // C6 (rows show 36–83, 48 semitones)
const EDITOR_PITCH_COUNT = EDITOR_MIDI_MAX - EDITOR_MIDI_MIN;
const EDITOR_HEIGHT = 240;

// ─── LAYER CARD ───────────────────────────────────────────────
function LayerCard({
  name, notes, bpm, genre, enabled, onDownload, onRegenerate,
}: {
  name: string; notes: NoteEvent[]; bpm: number; genre: string;
  enabled: boolean; onDownload: () => void; onRegenerate: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const color = LAYER_COLORS[name] || '#FF6D3F';

  const handlePlay = () => {
    if (playing) { stopAllPlayback(); setPlaying(false); return; }
    setPlaying(true);
    playLayer(name as 'melody' | 'chords' | 'bass' | 'drums', notes, bpm, genre, () => setPlaying(false));
  };

  return (
    <motion.div
      variants={fadeUp}
      className={`layer-card active-${name}${!enabled ? ' opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <div>
            <p className="text-sm font-semibold capitalize leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>
              {notes.length} notes
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handlePlay}
            disabled={!enabled || notes.length === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title={playing ? 'Stop' : 'Play'}
          >
            {playing ? '■' : '▶'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={!enabled}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title={`Regenerate ${name}`}
          >
            ↻
          </button>
          <button
            onClick={onDownload}
            disabled={!enabled || notes.length === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,184,148,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            title="Download .mid"
          >
            ↓
          </button>
        </div>
      </div>
      <PianoRoll notes={notes} color={color} />
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
        <div className="flex gap-1.5">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton w-8 h-8 rounded-lg" />
        </div>
      </div>
      <div className="skeleton w-full rounded-md" style={{ height: 88 }} />
    </motion.div>
  );
}

// ─── PIANO ROLL EDITOR ────────────────────────────────────────
function PianoRollEditor({
  notes, color, bars, onNotesChange,
}: {
  notes: NoteEvent[];
  color: string;
  bars: number;
  onNotesChange: (notes: NoteEvent[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalBeats = bars * 4;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = EDITOR_HEIGHT;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const rowH = h / EDITOR_PITCH_COUNT;

    // Background
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, w, h);

    // Pitch row shading (black keys darker)
    for (let i = 0; i < EDITOR_PITCH_COUNT; i++) {
      const pitch = (EDITOR_MIDI_MAX - 1) - i;
      if ([1, 3, 6, 8, 10].includes(pitch % 12)) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, i * rowH, w, rowH);
      }
    }

    // Horizontal lines (C notes brighter)
    for (let i = 0; i <= EDITOR_PITCH_COUNT; i++) {
      const pitch = (EDITOR_MIDI_MAX - 1) - i;
      const y = i * rowH;
      const isC = pitch % 12 === 0;
      ctx.strokeStyle = isC ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.035)';
      ctx.lineWidth = isC ? 0.8 : 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Vertical beat lines
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = (beat / totalBeats) * w;
      const isBar = beat % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Half-beat lines
    for (let hb = 1; hb < totalBeats * 2; hb += 2) {
      const x = (hb / 2 / totalBeats) * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Notes
    ctx.save();
    for (const note of notes) {
      if (note.pitch < EDITOR_MIDI_MIN || note.pitch >= EDITOR_MIDI_MAX) continue;
      const pi = (EDITOR_MIDI_MAX - 1) - note.pitch;
      const x = (note.startTime / totalBeats) * w;
      const nw = Math.max(3, (note.duration / totalBeats) * w) - 1;
      const y = pi * rowH + 1;
      const nh = Math.max(2, rowH - 2);
      const r = Math.min(2, nh / 2, nw / 2);
      ctx.globalAlpha = 0.5 + (note.velocity / 127) * 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + nw - r, y);
      ctx.quadraticCurveTo(x + nw, y, x + nw, y + r);
      ctx.lineTo(x + nw, y + nh - r);
      ctx.quadraticCurveTo(x + nw, y + nh, x + nw - r, y + nh);
      ctx.lineTo(x + r, y + nh);
      ctx.quadraticCurveTo(x, y + nh, x, y + nh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }, [notes, color, totalBeats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw();
    const obs = new ResizeObserver(() => draw());
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = canvas.clientWidth;
    const rowH = EDITOR_HEIGHT / EDITOR_PITCH_COUNT;

    // Check hit on existing note (reverse order = topmost first)
    let hitIdx = -1;
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (note.pitch < EDITOR_MIDI_MIN || note.pitch >= EDITOR_MIDI_MAX) continue;
      const pi = (EDITOR_MIDI_MAX - 1) - note.pitch;
      const nx = (note.startTime / totalBeats) * w;
      const nw = Math.max(3, (note.duration / totalBeats) * w);
      const ny = pi * rowH;
      if (x >= nx && x <= nx + nw && y >= ny && y < ny + rowH) { hitIdx = i; break; }
    }

    if (hitIdx !== -1) {
      onNotesChange(notes.filter((_, i) => i !== hitIdx));
    } else {
      const pi = Math.floor(y / rowH);
      const pitch = (EDITOR_MIDI_MAX - 1) - pi;
      const snapped = Math.floor((x / w) * totalBeats / 0.25) * 0.25;
      if (pitch >= EDITOR_MIDI_MIN && pitch < EDITOR_MIDI_MAX && snapped >= 0 && snapped < totalBeats) {
        onNotesChange([...notes, { pitch, startTime: snapped, duration: 0.5, velocity: 80 }]);
      }
    }
  }, [notes, onNotesChange, totalBeats]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ width: '100%', height: EDITOR_HEIGHT, display: 'block', cursor: 'crosshair' }}
    />
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

// ─── SPLICE SEARCH TERMS ──────────────────────────────────────
const SPLICE_INSTRUMENTS: Record<string, { melody: string; chords: string; bass: string; drums: string }> = {
  deep_house:        { melody: 'pluck',       chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  melodic_house:     { melody: 'melody',      chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  tech_house:        { melody: 'pluck',       chords: 'chord stab',   bass: 'bass loop',  drums: 'kick'         },
  minimal_tech:      { melody: 'lead',        chords: 'chord',        bass: 'bass',       drums: 'kick'         },
  techno:            { melody: 'lead',        chords: 'chord',        bass: 'bass',       drums: 'kick loop'    },
  melodic_techno:    { melody: 'lead',        chords: 'pad',          bass: 'bass',       drums: 'kick'         },
  hard_techno:       { melody: 'lead',        chords: 'stab',         bass: 'bass',       drums: 'kick'         },
  progressive_house: { melody: 'synth',       chords: 'chord pad',    bass: 'bass loop',  drums: 'kick'         },
  afro_house:        { melody: 'melody',      chords: 'chord',        bass: 'bass loop',  drums: 'percussion'   },
  trance:            { melody: 'lead',        chords: 'supersaw pad', bass: 'bass',       drums: 'kick'         },
  house:             { melody: 'piano',       chords: 'chord stab',   bass: 'bass loop',  drums: 'kick'         },
  drum_and_bass:     { melody: 'melody',      chords: 'chord',        bass: 'reese bass', drums: 'break'        },
  hiphop:            { melody: 'melody',      chords: 'chord',        bass: '808',        drums: 'drum loop'    },
  rnb:               { melody: 'melody',      chords: 'chord pad',    bass: 'bass',       drums: 'drum loop'    },
  disco_nu_disco:    { melody: 'melody',      chords: 'chord',        bass: 'bass loop',  drums: 'disco drum'   },
};

function getSpliceTerms(genreKey: string, bpm: number): Record<'melody' | 'chords' | 'bass' | 'drums', string> {
  const genreName = GENRES[genreKey]?.name ?? genreKey;
  const inst = SPLICE_INSTRUMENTS[genreKey] ?? { melody: 'melody', chords: 'chord', bass: 'bass', drums: 'drums' };
  return {
    melody: `${genreName} ${inst.melody} ${bpm}`,
    chords: `${genreName} ${inst.chords}`,
    bass:   `${genreName} ${inst.bass} ${bpm}`,
    drums:  `${genreName} ${inst.drums}`,
  };
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
  ctx.fillStyle = '#0D0D12';
  ctx.fillRect(0, 0, width, height);

  // Header text
  ctx.fillStyle = 'rgba(240,240,255,0.92)';
  ctx.font = '700 14px Syne, sans-serif';
  ctx.fillText(`${layer.toUpperCase()} — Sheet Music`, 16, 26);
  ctx.fillStyle = 'rgba(138,138,154,0.8)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`4/4  ·  Key: ${params.key} ${scaleLabel(params.scale)}  ·  ${params.bpm} BPM`, 16, 46);

  const staffTop = 86;
  const staffLeft = 16;
  const staffRight = width - 16;
  const lineGap = 12;

  // Staff (5 lines)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
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
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
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
    ctx.fillStyle = filled ? 'rgba(240,240,255,0.92)' : 'rgba(13,13,18,1)';
    ctx.strokeStyle = 'rgba(240,240,255,0.92)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Stem (skip for whole notes)
    if (!isWhole) {
      const stemUp = y > staffTop + lineGap * 2; // simplistic
      ctx.strokeStyle = 'rgba(240,240,255,0.92)';
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

// ─── AUDIO → MIDI (FFT) ────────────────────────────────────────
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
  compareHighlight,
}: {
  label: string;
  result: GenerationResult;
  variationParams: GenerationParams;
  selected: boolean;
  isPlaying: boolean;
  compareHighlight?: boolean;
  onSelect: () => void;
  onPlayToggle: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onExtend?: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      variants={fadeUp}
      onClick={onSelect}
      animate={compareHighlight ? { boxShadow: ['0 0 0 0 rgba(255,109,63,0.00)', '0 0 0 6px rgba(255,109,63,0.22)', '0 0 0 0 rgba(255,109,63,0.00)'] } : { boxShadow: 'none' }}
      transition={compareHighlight ? { duration: 1.1, repeat: Infinity, ease: 'easeOut' } : { duration: 0.15 }}
      style={{
        border: compareHighlight ? '2px solid rgba(255,109,63,0.95)' : (selected ? '1.5px solid #FF6D3F' : '1px solid #1A1A2E'),
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        background: selected ? 'rgba(255,109,63,0.04)' : '#111118',
        transition: 'border-color 0.15s, background 0.15s',
        flex: 1,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: selected ? '#FF6D3F' : '#F0F0FF' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8A8A9A' }}>
          {variationParams.bpm} BPM
        </span>
      </div>
      <PianoRoll notes={vResult.melody} color="#FF6D3F" height={56} />
      <div className="flex gap-1.5 flex-wrap mt-3 mb-1">
        {deriveChordProgression(vResult.chords, variationParams.bars).map((name, i, arr) => (
          <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8A8A9A', display: 'flex', alignItems: 'center', gap: 4 }}>
            {name}
            {i < arr.length - 1 && <span style={{ color: 'rgba(138,138,154,0.35)' }}>→</span>}
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={onPlayToggle}
          className="flex-1 h-8 flex items-center justify-center rounded-lg text-xs transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button
          onClick={onDownload}
          disabled={!selected}
          className="flex-1 h-8 flex items-center justify-center rounded-lg text-xs transition-all disabled:opacity-30"
          style={{ border: selected ? '1px solid rgba(0,184,148,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { if (selected) e.currentTarget.style.borderColor = 'rgba(0,184,148,0.7)'; }}
          onMouseLeave={e => { if (selected) e.currentTarget.style.borderColor = 'rgba(0,184,148,0.4)'; }}
          title={selected ? 'Download all tracks' : 'Select this variation to download'}
        >
          ↓ All
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
                    border: `1px solid ${LAYER_COLORS[layer]}33`,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: LAYER_COLORS[layer],
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${LAYER_COLORS[layer]}12`)}
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
            style={{ border: '1px solid rgba(255,255,255,0.10)', color: '#F0F0FF' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
            title="Extend this variation by 8 bars"
          >
            + Extend 8 bars
          </button>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1A1A2E' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(138,138,154,0.45)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Find on Splice
            </p>
            {(['melody', 'chords', 'bass', 'drums'] as const).map(layer => {
              const term = getSpliceTerms(variationParams.genre, variationParams.bpm)[layer];
              return (
                <div key={layer} className="flex items-center gap-2 mb-1.5">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: LAYER_COLORS[layer], width: 40, flexShrink: 0 }}>
                    {layer.charAt(0).toUpperCase() + layer.slice(1, 3)}
                  </span>
                  <a
                    href={`https://splice.com/sounds/search?q=${encodeURIComponent(term)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8A8A9A', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#F0F0FF')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#8A8A9A')}
                  >
                    {term} ↗
                  </a>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── COMMAND BAR ──────────────────────────────────────────────
function CommandBar({
  isOpen, onClose, onGenerate, onFocusPrompt, onToggleLayers, onDownloadAll, hasResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onFocusPrompt: () => void;
  onToggleLayers: () => void;
  onDownloadAll: () => void;
  hasResult: boolean;
}) {
  const actions = [
    { icon: '✦', label: 'Generate track',       hint: 'G', action: onGenerate,      enabled: true },
    { icon: '↵', label: 'Focus prompt',          hint: 'I', action: onFocusPrompt,  enabled: true },
    { icon: '⊙', label: 'Toggle all layers',     hint: 'L', action: onToggleLayers, enabled: true },
    { icon: '↓', label: 'Download last MIDI',    hint: 'D', action: onDownloadAll,  enabled: hasResult },
  ];

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
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className="cmd-modal">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid #1A1A2E' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8A8A9A' }}>
                    Quick actions
                  </span>
                  <kbd>ESC</kbd>
                </div>

                {/* Actions */}
                <div className="p-2">
                  {actions.map(a => (
                    <button
                      key={a.label}
                      className="cmd-action"
                      disabled={!a.enabled}
                      onClick={() => { a.action(); onClose(); }}
                    >
                      <span className="flex items-center gap-3">
                        <span style={{ color: '#FF6D3F', fontSize: 14, width: 16, textAlign: 'center' }}>{a.icon}</span>
                        <span style={{ fontSize: 14 }}>{a.label}</span>
                      </span>
                      <kbd>{a.hint}</kbd>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-center gap-2"
                  style={{ borderTop: '1px solid #1A1A2E' }}>
                  <kbd>⌘K</kbd>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.4)' }}>
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

// ─── HISTORY SIDEBAR ──────────────────────────────────────────
function HistorySidebar({
  history, loading, onRestore, onClose,
}: {
  history: HistoryEntry[];
  loading: boolean;
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed right-0 top-0 h-full w-80 z-40 flex flex-col"
      style={{ background: '#111118', borderLeft: '1px solid #1A1A2E' }}
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between px-6 py-5"
        style={{ borderBottom: '1px solid #1A1A2E' }}>
        <span className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          History
          {!loading && history.length > 0 && (
            <span className="ml-2 text-xs font-normal"
              style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>
              ({history.length})
            </span>
          )}
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none transition-colors"
          style={{ color: '#8A8A9A' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0F0FF')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8A8A9A')}
        >×</button>
      </div>

      {loading ? (
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
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
      ) : history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-center leading-relaxed" style={{ color: '#8A8A9A' }}>
            Generate a track to see your history here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {history.map(entry => (
            <button
              key={entry.id}
              onClick={() => onRestore(entry)}
              className="w-full text-left px-6 py-4 transition-colors"
              style={{ borderBottom: '1px solid rgba(26,26,46,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm mb-2" style={{ color: 'rgba(240,240,255,0.85)' }}>
                    {(entry.prompt || '—').length > 40
                      ? `${(entry.prompt || '—').slice(0, 40).trimEnd()}…`
                      : (entry.prompt || '—')}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F' }}>
                      {GENRES[entry.genre]?.name || entry.genre}
                    </span>
                    <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>
                      {entry.bpm} BPM
                    </span>
                  </div>
                </div>
                <span
                  className="text-xs flex-shrink-0"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}
                >
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="px-6 py-4" style={{ borderTop: '1px solid #1A1A2E' }}>
        <p className="text-xs text-center"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}>
          Last 10 generations · synced to account
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: '#111118', border: '1px solid #1A1A2E' }}
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="text-3xl mb-4" style={{ color: '#FF6D3F' }}>✦</div>
        <h2 className="font-extrabold text-xl mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
          You&apos;ve used your 10 free<br />generations this month.
        </h2>
        <p className="text-sm mb-8" style={{ color: '#8A8A9A' }}>
          Upgrade to Pro for unlimited access.
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
            style={{ color: '#8A8A9A' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F0FF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8A8A9A')}
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
const GENRE_LIST = Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name }));
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

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Describe or pick a style',
    body: 'Type a prompt like "dark techno, Am, 130bpm" or click any style tag to load a preset instantly.',
  },
  {
    num: '02',
    title: '4 tracks generate in under a second',
    body: 'Melody, chords, bass, and drums are written simultaneously using genre-tuned music theory rules.',
  },
  {
    num: '03',
    title: 'Drop the .mid into your DAW',
    body: 'Download individual tracks or the full multi-track .mid. Tested in FL Studio, Ableton, and Logic.',
  },
];

const LAYER_EXPLAINER = [
  {
    name: 'Melody',   key: 'melody' as const, color: '#FF6D3F', range: 'C4 – C6',
    body: 'Genre-matched lead lines. Density and rhythm adapt to tempo and style — sparse for house, dense for trance.',
  },
  {
    name: 'Chords',   key: 'chords' as const, color: '#A78BFA', range: 'C3 – C5',
    body: 'Triads, sevenths, or extended voicings based on genre. Rhythm ranges from sustained pads to staccato stabs.',
  },
  {
    name: 'Bass',     key: 'bass' as const,   color: '#00B894', range: 'C1 – C3',
    body: 'Root, walking, octave, syncopated, or 808 style. Locked to chord changes for musical coherence.',
  },
  {
    name: 'Drums',    key: 'drums' as const,  color: '#E94560', range: 'GM map',
    body: 'Pattern-driven: four-on-floor, breakbeat, trap, DnB, shuffle. Hat density from 8 to 32 steps per bar.',
  },
];

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function Home() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const e2eBypass = process.env.NEXT_PUBLIC_E2E === '1';
  const effectiveIsSignedIn = e2eBypass ? true : isSignedIn;
  const effectiveUserId = e2eBypass ? 'e2e' : userId;
  const toast = useToast();
  const [params, setParams] = useState<GenerationParams>(getDefaultParams());
  const [variations, setVariations] = useState<{ result: GenerationResult; params: GenerationParams }[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [playingVariationIndex, setPlayingVariationIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIndex, setCompareIndex] = useState(0);
  const [liveMode, setLiveMode] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeStyleTag, setActiveStyleTag] = useState<string | null>(null);
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [credits, setCredits] = useState<{ used: number; isPro: boolean } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [editorLayer, setEditorLayer] = useState<typeof EDITOR_LAYERS[number]>('melody');
  const [variationIds, setVariationIds] = useState<(string | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [showBpmDetect, setShowBpmDetect] = useState(false);
  const [isDetectingBpm, setIsDetectingBpm] = useState(false);
  const [collabCopied, setCollabCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingTargetRect, setOnboardingTargetRect] = useState<DOMRect | null>(null);
  const [showInspire, setShowInspire] = useState(false);
  const [inspireText, setInspireText] = useState('');
  const [isInspiring, setIsInspiring] = useState(false);
  const [inspirationChips, setInspirationChips] = useState<string[]>([]);
  const lastInspirationSourceRef = useRef<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [editorView, setEditorView] = useState<'piano' | 'sheet'>('piano');
  const [importedNotes, setImportedNotes] = useState<NoteEvent[]>([]);
  const [showAudioToMidi, setShowAudioToMidi] = useState(false);
  const [isConvertingAudio, setIsConvertingAudio] = useState(false);

  const result = variations[selectedVariation]?.result ?? null;

  const selectedParams = useMemo(() => variations[selectedVariation]?.params ?? params, [variations, selectedVariation, params]);
  const selectedLayerNotes = useMemo(() => {
    if (editorLayer === 'imported') return importedNotes;
    return result?.[editorLayer] ?? [];
  }, [result, editorLayer, importedNotes]);

  const toolRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const tapTimesRef = useRef<number[]>([]);
  const tapResetTimerRef = useRef<number | null>(null);
  const bpmFileInputRef = useRef<HTMLInputElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const compareTimerRef = useRef<number | null>(null);

  const closeAllModals = useCallback(() => {
    setShowShortcuts(false);
    setShowEmbedModal(false);
    setShowCommandBar(false);
    setShowUpgradeModal(false);
    setShowHistory(false);
    setShowInspire(false);
    setShowBpmDetect(false);
    setShowAudioToMidi(false);
    setShowOnboarding(false);
  }, []);
  const liveTimerRef = useRef<number | null>(null);
  const liveBarRef = useRef(0);
  const livePendingParamsRef = useRef<GenerationParams | null>(null);
  const livePendingResultRef = useRef<GenerationResult | null>(null);

  useEffect(() => {
    if (editorView !== 'sheet') return;
    if (!sheetCanvasRef.current) return;
    if (!selectedLayerNotes) return;
    drawSheetMusic(sheetCanvasRef.current, selectedLayerNotes, selectedParams, editorLayer);
  }, [editorView, selectedLayerNotes, selectedParams, editorLayer]);

  const audioToMidiInputRef = useRef<HTMLInputElement>(null);

  const handleAudioToMidiFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsConvertingAudio(true);
    try {
      const arr = await file.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audio = await ctx.decodeAudioData(arr.slice(0));
      await ctx.close().catch(() => {});

      const detected = detectNotesFromAudio(audio, params.bpm);
      setImportedNotes(detected);
      setEditorLayer('imported');
      setEditorView('piano');

      toast.toast(`Audio converted to MIDI — ${detected.length} notes detected`, 'success');
    } catch {
      toast.toast('Audio to MIDI failed', 'danger');
    } finally {
      setIsConvertingAudio(false);
      if (audioToMidiInputRef.current) audioToMidiInputRef.current.value = '';
    }
  }, [params.bpm, toast]);
  const generateBtnWrapRef = useRef<HTMLDivElement>(null);
  const styleTagsRef = useRef<HTMLDivElement>(null);
  const genreSelectRef = useRef<HTMLSelectElement>(null);
  const layerCardsRef = useRef<HTMLDivElement>(null);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Open history from other pages via /?history=1
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get('history') === '1') {
        setShowHistory(true);
      }
    } catch {
      // ignore
    }
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

  const loadUserCredits = useCallback(async (uid: string) => {
    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (error || !data) {
        await supabase.from('user_credits').insert({ user_id: uid, credits_used: 0, is_pro: false });
        setCredits({ used: 0, isPro: false });
        return;
      }

      const createdAt = new Date(data.created_at as string);
      if (createdAt.getMonth() !== now.getMonth() || createdAt.getFullYear() !== now.getFullYear()) {
        await supabase
          .from('user_credits')
          .update({ credits_used: 0, created_at: now.toISOString() })
          .eq('user_id', uid);
        setCredits({ used: 0, isPro: data.is_pro as boolean });
        return;
      }

      setCredits({ used: data.credits_used as number, isPro: data.is_pro as boolean });
    } catch {
      // Ignore credit load errors
    }
  }, []);

  const checkCreditsAllowed = useCallback(async (uid: string): Promise<boolean> => {
    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (error || !data) return true;

      const createdAt = new Date(data.created_at as string);
      if (createdAt.getMonth() !== now.getMonth() || createdAt.getFullYear() !== now.getFullYear()) return true;
      if (data.is_pro) return true;
      return (data.credits_used as number) < 10;
    } catch {
      return true;
    }
  }, []);

  const incrementCredits = useCallback(async (uid: string) => {
    try {
      const now = new Date();
      const { data } = await supabase.from('user_credits').select('*').eq('user_id', uid).single();

      if (!data) {
        await supabase.from('user_credits').insert({ user_id: uid, credits_used: 1, is_pro: false });
        return;
      }

      const createdAt = new Date(data.created_at as string);
      if (createdAt.getMonth() !== now.getMonth() || createdAt.getFullYear() !== now.getFullYear()) {
        await supabase.from('user_credits').update({ credits_used: 1, created_at: now.toISOString() }).eq('user_id', uid);
      } else {
        await supabase.from('user_credits').update({ credits_used: (data.credits_used as number) + 1 }).eq('user_id', uid);
      }
    } catch {
      // Ignore
    }
  }, []);

  const loadHistoryFromDb = useCallback(async (uid: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('id, prompt, genre, bpm, style_tag, layers, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data) return;

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
    } catch {
      // Ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

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
  }, []);

  // Load credits + history when signed in
  useEffect(() => {
    if (!effectiveIsSignedIn || !effectiveUserId) return;
    loadUserCredits(effectiveUserId);
    loadHistoryFromDb(effectiveUserId);
    if (!e2eBypass) loadInspirationChipsFromDb(effectiveUserId);
  }, [effectiveIsSignedIn, effectiveUserId, loadUserCredits, loadHistoryFromDb, loadInspirationChipsFromDb, e2eBypass]);

  // First-time onboarding (only if 0 generations in Supabase)
  useEffect(() => {
    if (!isLoaded || !effectiveIsSignedIn || !effectiveUserId) return;
    const key = 'pulp_onboarding_complete_v1';
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {
      // Ignore
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { count } = await supabase
          .from('generations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId)
          .limit(1);
        if (cancelled) return;
        if ((count ?? 0) === 0) {
          setShowOnboarding(true);
          setOnboardingStep(0);
        }
      } catch {
        // Ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, effectiveIsSignedIn, effectiveUserId]);

  const completeOnboarding = useCallback(() => {
    const key = 'pulp_onboarding_complete_v1';
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Ignore
    }
    setShowOnboarding(false);
  }, []);

  // Ensure manual controls are open for step 2 (genre selector)
  useEffect(() => {
    if (!showOnboarding) return;
    if (onboardingStep === 1) setShowManual(true);
  }, [showOnboarding, onboardingStep]);

  // Position onboarding tooltip on current step
  useEffect(() => {
    if (!showOnboarding) return;

    const getRect = () => {
      if (onboardingStep === 0) return promptRef.current?.getBoundingClientRect() ?? null;
      if (onboardingStep === 1) return (genreSelectRef.current ?? styleTagsRef.current)?.getBoundingClientRect() ?? null;
      if (onboardingStep === 2) return generateBtnWrapRef.current?.getBoundingClientRect() ?? null;
      if (onboardingStep === 3) return layerCardsRef.current?.getBoundingClientRect() ?? null;
      return null;
    };

    const update = () => setOnboardingTargetRect(getRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true } as AddEventListenerOptions);
    const id = window.setInterval(update, 250);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update as any);
      window.clearInterval(id);
    };
  }, [showOnboarding, onboardingStep, result]);

  // ── GENERATE ─────────────────────────────────────────────────

  const handleGenerate = useCallback(async (overrideParams?: Partial<GenerationParams>, overridePrompt?: string) => {
    // Check credits before generating (signed-in users only)
    if (!e2eBypass && effectiveIsSignedIn && effectiveUserId) {
      const allowed = await checkCreditsAllowed(effectiveUserId);
      if (!allowed) {
        setShowUpgradeModal(true);
        return;
      }
    }

    setIsGenerating(true);
    setVariationIds([]);

    // Try Claude AI prompt parsing, fall back silently
    let aiParsed: Partial<GenerationParams> = {};
    const promptText = overridePrompt ?? prompt;
    if (!e2eBypass && promptText && effectiveIsSignedIn) {
      try {
        const res = await fetch('/api/parse-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText }),
        });
        if (res.status === 429) {
          const d = await res.json().catch(() => null) as any;
          const after = typeof d?.retryAfter === 'number' ? d.retryAfter : null;
          toast.toast(`Rate limit exceeded${after ? ` — try again in ${after}s` : ''}`, 'danger');
          // Fall back to rule-based parser.
          throw new Error('rate-limited');
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

    const parsed = promptText ? parsePrompt(promptText) : {};
    const finalParams: GenerationParams = { ...params, ...parsed, ...aiParsed, ...overrideParams };
    setParams(finalParams);

    setTimeout(async () => {
      const p1 = finalParams;
      const p2 = { ...finalParams, bpm: Math.min(200, finalParams.bpm + 4) };
      const p3 = { ...finalParams, bpm: Math.max(60, finalParams.bpm - 4) };

      const generateViaApi = async (p: GenerationParams) => {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bpm: p.bpm,
            genre: p.genre,
            key: p.key,
            bars: p.bars,
            prompt: promptText ?? '',
          }),
        });

        if (res.status === 429) {
          const d = await res.json().catch(() => null) as any;
          const after = typeof d?.retryAfter === 'number' ? d.retryAfter : null;
          toast.toast(`Rate limit exceeded${after ? ` — try again in ${after}s` : ''}`, 'danger');
          throw new Error('rate-limited');
        }

        if (res.status === 400) {
          const d = await res.json().catch(() => null) as any;
          toast.toast('Invalid input', 'danger');
          throw new Error(d?.error || 'invalid input');
        }

        if (!res.ok) throw new Error('generate failed');
        const data = await res.json() as { result: GenerationResult };
        return data.result;
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
          [gen1, gen2, gen3] = await Promise.all([generateViaApi(p1), generateViaApi(p2), generateViaApi(p3)]);
        } catch {
          // Fallback to local generation (keeps app usable if API is misconfigured).
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
      setIsGenerating(false);

      track('generation_created', {
        genre: finalParams.genre,
        bpm: finalParams.bpm,
        style_tag: activeStyleTag ?? '',
      });

      // Persist to Supabase + update credits
      if (!e2eBypass && effectiveIsSignedIn && effectiveUserId) {
        try {
          const ins = (layers: GenerationResult, p: GenerationParams) =>
            supabase.from('generations').insert({
              user_id: effectiveUserId,
              prompt: promptText,
              genre: p.genre,
              bpm: p.bpm,
              style_tag: activeStyleTag,
              layers,
            }).select('id').single();
          const [r1, r2, r3] = await Promise.all([ins(gen1, p1), ins(gen2, p2), ins(gen3, p3)]);
          setVariationIds([r1.data?.id ?? null, r2.data?.id ?? null, r3.data?.id ?? null]);

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

          await incrementCredits(effectiveUserId);
          await loadUserCredits(effectiveUserId);
          await loadHistoryFromDb(effectiveUserId);
        } catch {
          // Ignore save errors
        }
      }
    }, 320);
  }, [params, prompt, e2eBypass, effectiveIsSignedIn, effectiveUserId, activeStyleTag, checkCreditsAllowed, incrementCredits, loadUserCredits, loadHistoryFromDb, loadInspirationChipsFromDb]);

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
    if (liveMode) return;
    if (compareMode) return;
    if (playingAll) { stopAllPlayback(); setPlayingAll(false); return; }
    setPlayingAll(true);
    playNotes({
      melody: params.layers.melody ? sel.result.melody : undefined,
      chords: params.layers.chords ? sel.result.chords : undefined,
      bass:   params.layers.bass   ? sel.result.bass   : undefined,
      drums:  params.layers.drums  ? sel.result.drums  : undefined,
      bpm: sel.params.bpm,
      genre: sel.params.genre,
      onComplete: () => setPlayingAll(false),
    });
  };

  const stopCompare = useCallback((opts?: { stopAudio?: boolean }) => {
    if (compareTimerRef.current !== null) window.clearTimeout(compareTimerRef.current);
    compareTimerRef.current = null;
    setCompareMode(false);
    if (opts?.stopAudio) {
      stopAllPlayback();
      setPlayingVariationIndex(null);
    }
  }, []);

  const startVariationPlayback = useCallback((i: number) => {
    const v = variations[i];
    if (!v) return;
    stopAllPlayback();
    setPlayingAll(false);
    setPlayingVariationIndex(i);
    playNotes({
      melody: params.layers.melody ? v.result.melody : undefined,
      chords: params.layers.chords ? v.result.chords : undefined,
      bass:   params.layers.bass   ? v.result.bass   : undefined,
      drums:  params.layers.drums  ? v.result.drums  : undefined,
      bpm: v.params.bpm,
      genre: v.params.genre,
      onComplete: () => setPlayingVariationIndex(null),
    });
  }, [variations, params.layers]);

  const startCompare = useCallback(() => {
    if (variations.length === 0) return;
    stopAllPlayback();
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

  const stopLive = useCallback(() => {
    if (liveTimerRef.current !== null) window.clearTimeout(liveTimerRef.current);
    liveTimerRef.current = null;
    liveBarRef.current = 0;
    livePendingParamsRef.current = null;
    livePendingResultRef.current = null;
    stopAllPlayback();
    setPlayingAll(false);
  }, []);

  const tickLive = useCallback(() => {
    const sel = variations[selectedVariation];
    if (!sel) return;
    if (!liveMode) return;

    // Apply pending regeneration at bar boundary
    if (livePendingResultRef.current && livePendingParamsRef.current) {
      const nextRes = livePendingResultRef.current;
      const nextParams = livePendingParamsRef.current;
      livePendingResultRef.current = null;
      livePendingParamsRef.current = null;

      // Swap pattern in state; keep only the selected variation updated
      setVariations(prev => prev.map((v, i) => (
        i === selectedVariation ? { result: nextRes, params: nextParams } : v
      )));

      // “Crossfade” approximation without engine gain access: stop current and wait 200ms.
      stopAllPlayback();
    }

    const current = variations[selectedVariation] ?? sel;
    const barCount = current.params.bars ?? params.bars;
    const barIndex = liveBarRef.current % Math.max(1, barCount);
    liveBarRef.current = barIndex + 1;

    const bpm = params.bpm; // take effect on next bar

    playNotes({
      melody: params.layers.melody ? sliceNotesToBar(current.result.melody, barIndex) : undefined,
      chords: params.layers.chords ? sliceNotesToBar(current.result.chords, barIndex) : undefined,
      bass:   params.layers.bass   ? sliceNotesToBar(current.result.bass, barIndex) : undefined,
      drums:  params.layers.drums  ? sliceNotesToBar(current.result.drums, barIndex) : undefined,
      bpm,
      genre: params.genre,
      onComplete: () => {},
    });

    const msPerBeat = 60_000 / Math.max(60, Math.min(200, bpm));
    const nextMs = Math.max(250, Math.round(msPerBeat * 4));
    liveTimerRef.current = window.setTimeout(() => tickLive(), nextMs);
  }, [variations, selectedVariation, liveMode, params, sliceNotesToBar]);

  // Live mode: regenerate on key changes and loop by bar.
  useEffect(() => {
    if (!liveMode) {
      stopLive();
      return;
    }

    // Start looping from bar 0
    stopAllPlayback();
    liveBarRef.current = 0;
    window.setTimeout(() => tickLive(), 10);

    return () => stopLive();
  }, [liveMode, tickLive, stopLive]);

  useEffect(() => {
    if (!liveMode) return;
    const sel = variations[selectedVariation];
    if (!sel) return;

    // Regenerate with current params (same key/scale/bpm/genre etc.)
    const nextParams: GenerationParams = { ...params };
    const next = generateTrack(nextParams);
    livePendingParamsRef.current = nextParams;
    livePendingResultRef.current = next;
  }, [
    liveMode,
    selectedVariation,
    variations,
    params.genre,
    params.bpm,
    params.key,
    params.scale,
    params.humanization,
    activeStyleTag,
  ]);

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
  }, [variations, selectedVariation]);

  const handleEditorNotesChange = useCallback((layer: typeof LAYERS[number], newNotes: NoteEvent[]) => {
    setVariations(prev => prev.map((v, i) =>
      i === selectedVariation ? { ...v, result: { ...v.result, [layer]: newNotes } } : v
    ));
  }, [selectedVariation]);

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
    downloadMidi(midi, `pulp-${genre.toLowerCase().replace(/\s/g, '-')}-${p.key}${p.scale}.mid`);
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
    } catch {
      toast.toast('Ableton export failed', 'danger');
    }
  }, [variations, selectedVariation, toast]);

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
    try {
      const res = await fetch('/api/inspire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspiration }),
      });
      if (res.status === 429) {
        const d = await res.json().catch(() => null) as any;
        const after = typeof d?.retryAfter === 'number' ? d.retryAfter : null;
        toast.toast(`Rate limit exceeded${after ? ` — try again in ${after}s` : ''}`, 'danger');
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

      toast.toast(`Inspired by ${inspiration}`, 'success');
      setShowInspire(false);
      setInspireText('');
    } catch {
      toast.toast('Inspire failed', 'danger');
    } finally {
      setIsInspiring(false);
    }
  }, [inspireText, params.genre, params.bpm, params.key, params.scale, toast]);

  const handleShare = useCallback(() => {
    const id = variationIds[selectedVariation];
    if (!id) return;
    const genreKey = variations[selectedVariation]?.params.genre ?? params.genre;
    track('generation_shared', { genre: genreKey });
    void navigator.clipboard.writeText(`/g/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [variationIds, selectedVariation, variations, params.genre]);

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

      toast.toast('Extended +8 bars', 'success');
    } catch {
      toast.toast('Extend failed', 'danger');
    } finally {
      setIsExtending(false);
    }
  }, [variations, selectedVariation, isGenerating, isExtending, toast]);

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

    toast.toast('Pattern completed — 8 bars added', 'success');
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
      toast.toast('BPM detection failed', 'danger');
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
      // ESC closes any open modal
      if (e.key === 'Escape') {
        e.preventDefault();
        stopCompare({ stopAudio: true });
        stopAllPlayback();
        setPlayingVariationIndex(null);
        setPlayingAll(false);
        closeAllModals();
        return;
      }

      // '?' opens shortcuts
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Don't steal keystrokes while typing (except cmd/ctrl combos and ESC/? handled above)
      const isCombo = e.metaKey || e.ctrlKey;
      if (!isCombo && isTypingTarget(e.target)) return;

      // Cmd/Ctrl shortcuts
      if (isCombo) {
        const k = e.key.toLowerCase();
        if (k === 'k') {
          e.preventDefault();
          setShowCommandBar(true);
          return;
        }
        if (k === 'd') {
          e.preventDefault();
          handleDownloadAll();
          return;
        }
        if (k === 's') {
          e.preventDefault();
          handleShare();
          return;
        }
      }

      // Single-key shortcuts
      if (e.key === ' ') {
        e.preventDefault();
        if (liveMode) return;
        if (compareMode) {
          // lock current compare variation
          stopCompare();
          startVariationPlayback(compareIndex);
          return;
        }
        if (playingVariationIndex === selectedVariation) {
          stopAllPlayback();
          setPlayingVariationIndex(null);
        } else {
          startVariationPlayback(selectedVariation);
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'g') {
        e.preventDefault();
        void handleGenerate();
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        setLiveMode(v => {
          const next = !v;
          if (next) {
            setPlayingAll(false);
            stopCompare({ stopAudio: true });
            stopAllPlayback();
          } else {
            stopAllPlayback();
          }
          return next;
        });
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        if (compareMode) stopCompare({ stopAudio: true });
        else startCompare();
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        void handleExtendSelected();
        return;
      }
      if (key === '1' || key === '2' || key === '3') {
        e.preventDefault();
        const idx = Number(key) - 1;
        if (!variations[idx]) return;
        stopCompare({ stopAudio: true });
        stopAllPlayback();
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
    handleExtendSelected,
    handleGenerate,
    handleShare,
    liveMode,
    playingVariationIndex,
    selectedVariation,
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
  return (
    <div className="min-h-screen">

      {/* ── ONBOARDING ── */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingTooltip
            title={
              onboardingStep === 0 ? 'Type what you want to create' :
              onboardingStep === 1 ? 'Pick your genre and style' :
              onboardingStep === 2 ? 'Hit Generate and get 3 variations' :
              'Play, edit, download or share'
            }
            body={
              onboardingStep === 0 ? 'Try “dark melodic techno, 128bpm, Am”. You can be specific or keep it vague.' :
              onboardingStep === 1 ? 'Choose a genre, then tap a style tag to load a preset instantly.' :
              onboardingStep === 2 ? 'Generate creates 3 variations. Click a card to select the one you like best.' :
              'Press Play, tweak notes in the piano roll, download MIDI, or share the generation link.'
            }
            stepLabel={`STEP ${onboardingStep + 1} / 4`}
            targetRect={onboardingTargetRect}
            canNext={
              onboardingStep < 2 ? true :
              onboardingStep === 2 ? variations.length > 0 :
              onboardingStep === 3 ? Boolean(result) :
              true
            }
            onNext={() => {
              if (onboardingStep >= 3) completeOnboarding();
              else setOnboardingStep(s => Math.min(3, s + 1));
            }}
            onSkip={completeOnboarding}
          />
        )}
      </AnimatePresence>

      {/* ── COMMAND BAR ── */}
      <CommandBar
        isOpen={showCommandBar}
        onClose={() => setShowCommandBar(false)}
        onGenerate={() => { if (effectiveIsSignedIn) { void handleGenerate(); } else setShowCommandBar(false); }}
        onFocusPrompt={handleCmdFocusPrompt}
        onToggleLayers={handleToggleAllLayers}
        onDownloadAll={handleDownloadAll}
        hasResult={variations.length > 0}
      />

      {/* ── SHORTCUTS MODAL ── */}
      <AnimatePresence>
        {showShortcuts && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowShortcuts(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[41] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 32px 90px rgba(0,0,0,0.65)',
              }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>
                    Keyboard shortcuts
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Press <span style={{ color: 'var(--accent)' }}>Esc</span> to close · Press <span style={{ color: 'var(--accent)' }}>?</span> anytime to open
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(false)}
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

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { k: 'Space', d: 'Play/Stop current variation' },
                  { k: 'G', d: 'Generate' },
                  { k: '1 / 2 / 3', d: 'Select variation 1, 2, 3' },
                  { k: 'L', d: 'Toggle Live mode' },
                  { k: 'C', d: 'Toggle Compare mode' },
                  { k: 'E', d: 'Extend current variation' },
                  { k: 'Ctrl/Cmd + D', d: 'Download MIDI (full)' },
                  { k: 'Ctrl/Cmd + S', d: 'Share (copy URL)' },
                  { k: 'Ctrl/Cmd + K', d: 'Open command bar' },
                  { k: 'Esc', d: 'Close any open modal' },
                  { k: '?', d: 'Open shortcuts' },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                    style={{ border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}
                  >
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>
                      {row.d}
                    </span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: 'var(--purple)',
                        border: '1px solid rgba(167,139,250,0.35)',
                        background: 'rgba(167,139,250,0.10)',
                        padding: '4px 8px',
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.k}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── EMBED MODAL ── */}
      <AnimatePresence>
        {showEmbedModal && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
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
                boxShadow: '0 32px 90px rgba(0,0,0,0.65)',
              }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-label="Embed"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>
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
                  {'<iframe src="https://pulp-4ubq.vercel.app/embed" width="100%" height="400" frameborder="0"></iframe>'}
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
                  className="btn-download btn-sm"
                  onClick={async () => {
                    const code = `<iframe src="https://pulp-4ubq.vercel.app/embed" width="100%" height="400" frameborder="0"></iframe>`;
                    try {
                      await navigator.clipboard.writeText(code);
                      setEmbedCopied(true);
                      window.setTimeout(() => setEmbedCopied(false), 1600);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {embedCopied ? 'Copied!' : 'Copy code'}
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

      {/* ── HISTORY SIDEBAR ── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowHistory(false)}
            />
            <HistorySidebar
              history={history}
              loading={historyLoading}
              onRestore={handleRestoreHistory}
              onClose={() => setShowHistory(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── NAV ── */}
      <div className={`transition-all duration-300 ${scrolled ? 'glass' : 'bg-transparent'}`}>
        <Navbar
          active="create"
          onHistory={() => setShowHistory(true)}
          historyCount={history.length}
        />
      </div>

      {/* ── HERO ── */}
      <section className="hero-noise min-h-screen px-8 flex flex-col justify-center">
        <div className="max-w-[1280px] mx-auto">

          {/* Staggered headline + subtitle */}
          <motion.div
            className="text-center mb-12"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              variants={fadeUp}
              className="text-gradient font-extrabold leading-[1.1]"
              style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(40px, 6vw, 64px)', letterSpacing: '-0.02em' }}
            >
              Generate MIDI.<br />Instantly.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 mx-auto leading-relaxed"
              style={{ fontSize: 16, color: '#8A8A9A', maxWidth: 560 }}
            >
              Describe a track. Get 4 independent MIDI tracks — melody, chords, bass, and drums —
              tuned to genre, key, and tempo. Download directly into your DAW.
            </motion.p>
          </motion.div>

          {/* ── GENERATOR ── */}
          <motion.div
            ref={toolRef}
            className="max-w-[720px] mx-auto"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.16 }}
          >

            {/* Prompt input */}
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base select-none"
                style={{ color: '#FF6D3F' }}>✦</span>
              <input
                ref={promptRef}
                type="text"
                value={prompt}
                onChange={e => { setPrompt(e.target.value); setActiveStyleTag(null); }}
                onKeyDown={e => e.key === 'Enter' && effectiveIsSignedIn && void handleGenerate()}
                placeholder="dark melodic techno, 128bpm, Am"
                className="input-field"
                style={{ paddingLeft: 40, paddingRight: 220 }}
              />
              <div className="absolute right-[104px] top-1/2 -translate-y-1/2">
                <SpotlightButton
                  type="button"
                  className="btn-secondary"
                  style={{ height: 36, padding: '0 12px', fontSize: 12 }}
                  onClick={() => setShowInspire(v => !v)}
                >
                  Inspire
                </SpotlightButton>
              </div>
              {effectiveIsSignedIn ? (
                <div ref={generateBtnWrapRef} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <SpotlightButton
                    className={`btn-primary${isGenerating ? ' pulsing' : ''}`}
                    style={{ height: 36, padding: '0 16px', fontSize: 13 }}
                    onClick={() => void handleGenerate()}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-2">
                        <span className="spinner" />
                        Generating
                      </span>
                    ) : 'Generate'}
                  </SpotlightButton>
                </div>
              ) : (
                <SignInButton mode="modal">
                  <SpotlightButton
                    className="btn-primary absolute right-2 top-1/2 -translate-y-1/2"
                    style={{ height: 36, padding: '0 16px', fontSize: 13 }}
                  >
                    Generate
                  </SpotlightButton>
                </SignInButton>
              )}
            </div>

            <AnimatePresence>
              {showInspire && (
                <motion.form
                  className="mb-4 rounded-xl p-3"
                  style={{ background: '#111118', border: '1px solid #1A1A2E' }}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  onSubmit={e => {
                    e.preventDefault();
                    void handleInspire();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={inspireText}
                      onChange={e => setInspireText(e.target.value)}
                      placeholder="Inspire from a song or artist..."
                      className="input-field"
                      style={{ height: 40, paddingLeft: 14, paddingRight: 14 }}
                      disabled={isInspiring}
                    />
                    <SpotlightButton
                      type="submit"
                      className="btn-primary"
                      style={{ height: 40, padding: '0 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                      disabled={isInspiring || !inspireText.trim()}
                    >
                      {isInspiring ? '…' : 'Apply'}
                    </SpotlightButton>
                  </div>

                  {effectiveIsSignedIn && inspirationChips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {inspirationChips.slice(0, 5).map(chip => (
                        <button
                          key={chip}
                          type="button"
                          className="style-pill"
                          style={{
                            borderColor: 'rgba(167,139,250,0.45)',
                            color: '#A78BFA',
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

                                toast.toast(`Inspired by ${chip}`, 'success');
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
            {effectiveIsSignedIn && credits !== null && !credits.isPro && (
              <p className="text-xs mb-3 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>
                <span style={{ color: credits.used >= 10 ? '#E94560' : '#8A8A9A' }}>
                  {Math.max(0, 10 - credits.used)} / 10
                </span>
                {' '}generations remaining ·{' '}
                <a href="/pricing" style={{ color: '#FF6D3F', textDecoration: 'none' }}>Upgrade to Pro</a>
              </p>
            )}

            {/* Style tags */}
            <div ref={styleTagsRef} className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
              {Object.keys(STYLE_TAGS).map(tag => (
                <button key={tag} onClick={() => handleStyleTag(tag)}
                  className={`style-pill${activeStyleTag === tag ? ' active' : ''}`}>
                  {tag}
                </button>
              ))}
            </div>

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

            {/* Manual controls */}
            <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid #1A1A2E' }}>
              <button
                onClick={() => setShowManual(!showManual)}
                className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                style={{ color: '#8A8A9A', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#F0F0FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8A8A9A')}
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
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-5 pb-5 pt-4 flex flex-col gap-4"
                      style={{ borderTop: '1px solid #1A1A2E' }}>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Genre</label>
                        <select
                          ref={genreSelectRef}
                          className="w-full"
                          value={params.genre}
                          onChange={e => setParams(p => ({ ...p, genre: e.target.value }))}
                        >
                          {GENRE_LIST.map(g => <option key={g.key} value={g.key}>{g.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-2 text-xs uppercase tracking-wider"
                            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Key</label>
                          <select
                            className="w-full"
                            value={params.key}
                            onChange={e => setParams(p => ({ ...p, key: e.target.value }))}
                          >
                            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-2 text-xs uppercase tracking-wider"
                            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Scale</label>
                          <select
                            className="w-full"
                            value={MANUAL_SCALE_OPTIONS.some(o => o.value === params.scale) ? params.scale : 'minor'}
                            onChange={e => setParams(p => ({ ...p, scale: e.target.value }))}
                          >
                            {MANUAL_SCALE_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs uppercase tracking-wider"
                            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Feel</label>
                          <span
                            className="text-xs tabular-nums"
                            style={{ color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}
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
                            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>BPM</label>
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
                                color: '#FFAB91',
                              }}
                            >
                              {(variations.length > 0 ? variations[selectedVariation]?.params.key : null) ?? params.key}{' '}
                              {scaleLabel((variations.length > 0 ? variations[selectedVariation]?.params.scale : null) ?? params.scale)}
                            </span>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: '#FF6D3F', fontFamily: 'JetBrains Mono, monospace' }}
                            >
                              {params.bpm}
                            </span>
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
                              color: '#F0F0FF',
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
                              color: '#F0F0FF',
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
                              style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Bars</label>
                        <select className="w-full" value={params.bars} onChange={e => setParams(p => ({ ...p, bars: parseInt(e.target.value) }))}>
                          {[2, 4, 8].map(b => <option key={b} value={b}>{b} bars</option>)}
                        </select>
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
                <motion.div
                  className="grid grid-cols-2 gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                >
                  {LAYERS.map(l => <SkeletonCard key={l} name={l} />)}
                </motion.div>
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
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8A8A9A' }}>
                          Comparing variations… <span style={{ color: '#FF6D3F' }}>V{compareIndex + 1}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.div
                    className="flex gap-3"
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
                        onSelect={() => {
                          if (compareMode) {
                            // Lock to clicked variation and stop comparing.
                            stopCompare();
                            setCompareIndex(i);
                            setSelectedVariation(i);
                            startVariationPlayback(i);
                            return;
                          }
                          stopAllPlayback();
                          setPlayingVariationIndex(null);
                          setPlayingAll(false);
                          setSelectedVariation(i);
                        }}
                        onPlayToggle={e => {
                          e.stopPropagation();
                          if (compareMode) stopCompare();
                          if (playingVariationIndex === i) {
                            stopAllPlayback();
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
                  className="flex gap-3 mb-5 flex-wrap items-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <SpotlightButton onClick={handlePlayAll} className="btn-secondary btn-sm">
                    {playingAll ? '■  Stop' : '▶  Play All'}
                  </SpotlightButton>
                  <SpotlightButton
                    type="button"
                    onClick={() => {
                      setLiveMode(v => {
                        const next = !v;
                        if (next) {
                          setPlayingAll(false);
                          stopAllPlayback();
                        } else {
                          stopAllPlayback();
                        }
                        return next;
                      });
                    }}
                    className="btn-secondary btn-sm"
                    style={liveMode ? { borderColor: 'rgba(233,69,96,0.45)' } : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: '#E94560',
                          boxShadow: liveMode ? '0 0 0 4px rgba(233,69,96,0.20)' : 'none',
                          animation: liveMode ? 'pulse-ring 1.2s ease-out infinite' : 'none',
                        }}
                      />
                      <span style={{ color: liveMode ? '#E94560' : '#F0F0FF' }}>
                        LIVE
                      </span>
                    </span>
                  </SpotlightButton>
                  <SpotlightButton onClick={handleDownloadAll} className="btn-download btn-sm">
                    ↓  Download MIDI
                  </SpotlightButton>
                  <SpotlightButton onClick={() => void handleExportAbleton()} className="btn-download btn-sm">
                    ↓  Export to Ableton
                  </SpotlightButton>
                  <SpotlightButton
                    type="button"
                    onClick={() => {
                      setShowAudioToMidi(v => {
                        const next = !v;
                        if (next) window.setTimeout(() => audioToMidiInputRef.current?.click(), 0);
                        return next;
                      });
                    }}
                    className="btn-secondary btn-sm"
                    style={showAudioToMidi ? { borderColor: 'rgba(167,139,250,0.45)' } : undefined}
                    disabled={isConvertingAudio}
                  >
                    Audio to MIDI
                  </SpotlightButton>
                  <SpotlightButton onClick={handleCreateCollab} className="btn-secondary btn-sm">
                    {collabCopied ? 'Copied!' : 'Collab'}
                  </SpotlightButton>
                  <SpotlightButton onClick={handleDownloadMusicXml} className="btn-secondary btn-sm">
                    ↓  Download MusicXML
                  </SpotlightButton>
                  <SpotlightButton onClick={handleDownloadJson} className="btn-secondary btn-sm">
                    ↓  Download JSON
                  </SpotlightButton>
                  <SpotlightButton onClick={() => void handleGenerate()} className="btn-secondary btn-sm">
                    ↻  Regenerate
                  </SpotlightButton>
                  {variationIds[selectedVariation] && (
                    <>
                      <SpotlightButton onClick={handleShare} className="btn-secondary btn-sm">
                        {copied ? 'Copied!' : 'Share'}
                      </SpotlightButton>
                      <SpotlightButton onClick={() => setShowEmbedModal(true)} className="btn-secondary btn-sm">
                        Embed
                      </SpotlightButton>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showAudioToMidi && (
                <motion.div
                  className="mb-5 rounded-xl p-3 flex items-center gap-3 flex-wrap"
                  style={{ background: '#111118', border: '1px solid #1A1A2E' }}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.6)', letterSpacing: '0.06em' }}>
                      AUDIO → MIDI
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A78BFA' }}>
                      Imported layer
                    </span>
                  </div>

                  <input
                    ref={audioToMidiInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-wav"
                    onChange={e => void handleAudioToMidiFile(e.target.files?.[0] ?? null)}
                    disabled={isConvertingAudio}
                    className="block text-xs"
                    style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}
                  />

                  <div className="flex items-center gap-2 ml-auto">
                    <SpotlightButton
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ borderColor: 'rgba(167,139,250,0.30)', color: '#A78BFA' }}
                      disabled={importedNotes.length === 0}
                      onClick={() => {
                        if (importedNotes.length === 0) return;
                        const midi = generateMidiFormat0(importedNotes, params.bpm, 'pulp-imported');
                        downloadMidi(midi, `pulp-imported-${params.bpm}bpm.mid`);
                      }}
                    >
                      ↓ Download Imported .mid
                    </SpotlightButton>
                    <SpotlightButton
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setShowAudioToMidi(false)}
                    >
                      Close
                    </SpotlightButton>
                  </div>
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
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <div className="rounded-2xl px-5 py-4" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
                    <p
                      className="leading-tight"
                      style={{
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 800,
                        fontSize: 26,
                        letterSpacing: '-0.01em',
                        backgroundImage: 'linear-gradient(90deg, #FF6D3F 0%, #FFAB91 100%)',
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
                      style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.6)' }}
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
                  className="grid grid-cols-2 gap-4"
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
                      />
                    )
                  )}
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
                        style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A', background: '#111118', border: '1px solid #1A1A2E' }}>
                        {tag}
                      </span>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Piano Roll Editor */}
            <AnimatePresence>
              {variations.length > 0 && !isGenerating && (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ border: '1px solid #1A1A2E', borderRadius: 12, overflow: 'hidden' }}
                >
                  {/* Header: label + layer tabs */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: '#111118', borderBottom: '1px solid #1A1A2E' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.5)', letterSpacing: '0.06em' }}>
                        EDITOR
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditorView('piano')}
                          className="px-3 h-7 rounded-md transition-all"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: editorView === 'piano' ? '#FF6D3F' : '#8A8A9A',
                            background: editorView === 'piano' ? 'rgba(255,109,63,0.14)' : 'transparent',
                            border: editorView === 'piano' ? '1px solid rgba(255,109,63,0.35)' : '1px solid transparent',
                          }}
                        >
                          Piano Roll
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorView('sheet')}
                          className="px-3 h-7 rounded-md transition-all"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: editorView === 'sheet' ? '#FF6D3F' : '#8A8A9A',
                            background: editorView === 'sheet' ? 'rgba(255,109,63,0.14)' : 'transparent',
                            border: editorView === 'sheet' ? '1px solid rgba(255,109,63,0.35)' : '1px solid transparent',
                          }}
                        >
                          Sheet Music
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editorView === 'piano' && (
                        <button
                          type="button"
                          className="px-3 h-7 rounded-md transition-all"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: '#F0F0FF',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                          onClick={handleCompletePattern}
                          title="Generate 8 bars continuing your pattern"
                        >
                          Complete Pattern
                        </button>
                      )}
                      {editorView === 'sheet' && (
                        <button
                          type="button"
                          className="px-3 h-7 rounded-md transition-all"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: '#F0F0FF',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,63,0.45)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                          onClick={() => {
                            const c = sheetCanvasRef.current;
                            if (!c) return;
                            const url = c.toDataURL('image/png');
                            const w = window.open('', '_blank');
                            if (!w) return;
                            w.document.write(`<!doctype html><html><head><title>Print Sheet</title></head><body style="margin:0;background:#09090B;display:flex;align-items:center;justify-content:center;"><img src="${url}" style="max-width:100%;height:auto;" /></body></html>`);
                            w.document.close();
                            w.focus();
                            w.print();
                          }}
                        >
                          Print
                        </button>
                      )}
                      <div className="flex gap-1">
                      {EDITOR_LAYERS.map(layer => (
                        <button
                          key={layer}
                          onClick={() => setEditorLayer(layer)}
                          className="px-3 h-7 rounded-md capitalize transition-all"
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: editorLayer === layer ? LAYER_COLORS[layer] : '#8A8A9A',
                            background: editorLayer === layer ? `${LAYER_COLORS[layer]}18` : 'transparent',
                            border: editorLayer === layer ? `1px solid ${LAYER_COLORS[layer]}40` : '1px solid transparent',
                          }}
                        >
                          {layer === 'imported' ? 'imported' : layer}
                        </button>
                      ))}
                    </div>
                    </div>
                  </div>

                  {/* Hint bar */}
                  <div className="px-4 py-1.5" style={{ background: '#0D0D12', borderBottom: '1px solid #1A1A2E' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(138,138,154,0.35)' }}>
                      {editorView === 'piano'
                        ? 'click note to delete · click empty to add (snaps to 1/16)'
                        : 'basic canvas score · durations are approximate'}
                    </span>
                  </div>

                  {/* Canvas */}
                  {editorView === 'piano' ? (
                    <PianoRollEditor
                      key={`${selectedVariation}-${editorLayer}`}
                      notes={editorLayer === 'imported' ? importedNotes : (result?.[editorLayer] ?? [])}
                      color={LAYER_COLORS[editorLayer] ?? '#FF6D3F'}
                      bars={variations[selectedVariation]?.params.bars ?? params.bars}
                      onNotesChange={newNotes => {
                        if (editorLayer === 'imported') setImportedNotes(newNotes);
                        else handleEditorNotesChange(editorLayer, newNotes);
                      }}
                    />
                  ) : (
                    <div style={{ padding: 12, background: '#0D0D12' }}>
                      <canvas
                        ref={sheetCanvasRef}
                        style={{ width: '100%', height: 320, borderRadius: 10, border: '1px solid #1A1A2E', background: '#0D0D12' }}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="text-center mt-12 space-y-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8A8A9A', letterSpacing: '0.04em' }}>
              20 genres · 15 styles · 4 independent tracks · .mid export
            </p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.45)' }}>
              No account required to generate
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        className="py-24 px-8"
        style={{ background: '#111118', borderTop: '1px solid #1A1A2E', borderBottom: '1px solid #1A1A2E' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <h2
            className="font-extrabold mb-16"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
          >
            3 steps.<br />0 fuss.
          </h2>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {HOW_IT_WORKS.map(step => (
              <div key={step.num}>
                <div className="text-gradient font-extrabold mb-5"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {step.num}
                </div>
                <h3 className="font-bold mb-3"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, letterSpacing: '-0.005em', lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: '#8A8A9A', lineHeight: 1.7 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GENRE GRID ── */}
      <section
        className="py-24 px-8"
      >
        <div className="max-w-[1280px] mx-auto">
          <h2
            className="font-extrabold mb-3"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
          >
            20 genres, built in.
          </h2>
          <p
            className="mb-12 text-sm"
            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Click any genre to load it into the generator.
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {GENRE_LIST.map(g => (
              <button
                key={g.key}
                onClick={() => { setParams(p => ({ ...p, genre: g.key })); setActiveStyleTag(null); scrollToTool(); }}
                className="genre-card text-left"
              >
                <span className="block font-bold text-sm leading-tight"
                  style={{ fontFamily: 'Syne, sans-serif', color: 'rgba(240,240,255,0.75)' }}>
                  {g.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── LAYER SYSTEM ── */}
      <section
        className="py-24 px-8"
        style={{ background: '#111118', borderTop: '1px solid #1A1A2E', borderBottom: '1px solid #1A1A2E' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <h2
            className="font-extrabold mb-3"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
          >
            4 independent tracks.
          </h2>
          <p
            className="mb-12"
            style={{ fontSize: 15, color: '#8A8A9A', maxWidth: 560, lineHeight: 1.7 }}
          >
            Each track has its own voice, rhythm, and range. Toggle any layer on or off. Download each one separately or all at once.
          </p>
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {LAYER_EXPLAINER.map(layer => (
              <div
                key={layer.key}
                className={`layer-card active-${layer.key}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: layer.color }} />
                  <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{layer.name}</span>
                  <span className="ml-auto text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>{layer.range}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#8A8A9A', lineHeight: 1.7 }}>{layer.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-8 py-16" style={{ borderTop: '1px solid #1A1A2E' }}>
        <div className="max-w-[1280px] mx-auto">

          {/* Top row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 mb-8"
            style={{ borderBottom: '1px solid #1A1A2E' }}>
            <span className="text-gradient font-extrabold text-2xl" style={{ fontFamily: 'Syne, sans-serif' }}>
              pulp
            </span>
            <nav className="flex items-center gap-8 text-sm" style={{ color: '#8A8A9A' }}>
              <button onClick={scrollToTool} className="transition-colors hover:text-white">Create</button>
              <button onClick={() => setShowHistory(true)} className="transition-colors hover:text-white">History</button>
            </nav>
            <span className="text-sm" style={{ color: '#8A8A9A' }}>
              a{' '}
              <span className="font-extrabold text-gradient" style={{ fontFamily: 'Syne, sans-serif' }}>papaya</span>
              <span style={{ color: '#00B894' }}>●</span>
              {' '}tool
            </span>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}>
              © 2026 PULP. MADE BY PAPAYA.
            </span>

            <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.55)' }}>
              <a href="/legal/terms" style={{ textDecoration: 'none', color: '#8A8A9A' }} className="transition-colors hover:text-white">
                Terms
              </a>
              <a href="/legal/privacy" style={{ textDecoration: 'none', color: '#8A8A9A' }} className="transition-colors hover:text-white">
                Privacy
              </a>
              <a href="/legal/license" style={{ textDecoration: 'none', color: '#8A8A9A' }} className="transition-colors hover:text-white">
                License
              </a>
            </div>

            {/* Live status */}
            <div className="flex items-center gap-2">
              <span className="status-dot" />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8A8A9A' }}>
                All systems operational
              </span>
            </div>

            <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}>
              zero APIs. runs in your browser.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
