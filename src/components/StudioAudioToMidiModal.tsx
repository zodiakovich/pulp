'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { NoteEvent } from '@/lib/music-engine';
import * as Pitchfinder from 'pitchfinder';

const PANEL = 'var(--surface)';
const BORDER = 'var(--border)';
const DASH = 'var(--border-weak)';
const ACCENT = '#FF6D3F';
const MUTED = 'var(--muted)';
const CTA_TEXT = 'var(--on-accent)';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SECONDS = 30;

type Mode = 'studio' | 'locked';

function extOk(name: string) {
  const l = name.toLowerCase();
  return l.endsWith('.wav') || l.endsWith('.mp3');
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function estimateVelFromRms(rms: number): number {
  // Map ~[0..0.25] RMS into MIDI velocity with a musically useful curve.
  const x = clamp(rms / 0.22, 0, 1);
  const curved = Math.pow(x, 0.65);
  return Math.round(25 + curved * 102);
}

function rmsOfWindow(buf: Float32Array, start: number, end: number): number {
  const n = Math.max(1, end - start);
  let sum = 0;
  for (let i = start; i < end; i++) {
    const s = buf[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const a = [...values].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? 0;
}

function buildNotesFromFrames(opts: {
  frames: Array<{ tSec: number; midi: number | null; rms: number }>;
  bpm: number;
}): NoteEvent[] {
  const secondsPerBeat = 60 / Math.max(60, Math.min(200, opts.bpm));
  const frames = opts.frames;
  if (frames.length === 0) return [];

  // Silence threshold based on RMS distribution.
  const rmsVals = frames.map(f => f.rms).sort((a, b) => a - b);
  const p60 = rmsVals[Math.floor(rmsVals.length * 0.6)] ?? 0;
  const p90 = rmsVals[Math.floor(rmsVals.length * 0.9)] ?? p60;
  const rmsThresh = p60 + (p90 - p60) * 0.22;

  const out: NoteEvent[] = [];
  let curMidi: number | null = null;
  let curStart = 0;
  let curLast = 0;
  let curVel = 80;

  const commit = () => {
    if (curMidi === null) return;
    const durSec = Math.max(0.08, curLast - curStart);
    out.push({
      pitch: clamp(curMidi, 24, 108),
      startTime: curStart / secondsPerBeat,
      duration: Math.max(0.125, durSec / secondsPerBeat),
      velocity: clamp(curVel, 1, 127),
    });
  };

  for (const f of frames) {
    const active = f.rms >= rmsThresh && f.midi !== null;
    const midi = active ? f.midi : null;
    const vel = estimateVelFromRms(f.rms);

    if (curMidi === null) {
      if (midi !== null) {
        curMidi = midi;
        curStart = f.tSec;
        curLast = f.tSec;
        curVel = vel;
      }
      continue;
    }

    if (midi === null) {
      commit();
      curMidi = null;
      continue;
    }

    // tolerate small pitch jitter
    if (Math.abs(midi - curMidi) <= 1) {
      curLast = f.tSec;
      curVel = Math.round((curVel * 0.85) + (vel * 0.15));
      continue;
    }

    commit();
    curMidi = midi;
    curStart = f.tSec;
    curLast = f.tSec;
    curVel = vel;
  }

  commit();
  return out;
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arr = await file.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    // Some browsers require copy
    const audio = await ctx.decodeAudioData(arr.slice(0));
    return audio;
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}

function mixToMono(buffer: AudioBuffer, maxSamples: number): Float32Array {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const n = Math.min(maxSamples, ch0.length);
  const mono = new Float32Array(n);
  if (!ch1) {
    mono.set(ch0.subarray(0, n));
    return mono;
  }
  for (let i = 0; i < n; i++) mono[i] = ((ch0[i] ?? 0) + (ch1[i] ?? 0)) * 0.5;
  return mono;
}

function guessMonophonicPitchFrames(opts: {
  mono: Float32Array;
  sampleRate: number;
  bpm: number;
  setProgress: (s: string) => void;
}): Array<{ tSec: number; midi: number | null; rms: number }> {
  const { mono, sampleRate, setProgress } = opts;

  // Window/hop tuned for monophonic tracking.
  const windowSize = 2048;
  const hop = 256;
  const frames: Array<{ tSec: number; midi: number | null; rms: number }> = [];

  const detectPitch = Pitchfinder.YIN({
    sampleRate,
    threshold: 0.12,
    probabilityThreshold: 0.1,
  });

  const work = new Float32Array(windowSize);
  const total = Math.max(1, Math.floor((mono.length - windowSize) / hop));

  for (let pos = 0, k = 0; pos + windowSize < mono.length; pos += hop, k++) {
    if (k % 120 === 0) {
      setProgress(`Detecting pitch… ${(k / total * 100).toFixed(0)}%`);
    }

    for (let i = 0; i < windowSize; i++) work[i] = mono[pos + i] ?? 0;

    const hz = detectPitch(work);
    const tSec = pos / sampleRate;
    const rms = rmsOfWindow(mono, pos, pos + windowSize);
    if (!hz || hz < 55 || hz > 1760) {
      frames.push({ tSec, midi: null, rms });
    } else {
      frames.push({ tSec, midi: freqToMidi(hz), rms });
    }
  }

  // simple median smoothing on midi values to reduce flutter
  const smoothed: Array<{ tSec: number; midi: number | null; rms: number }> = [];
  for (let i = 0; i < frames.length; i++) {
    const win = frames.slice(Math.max(0, i - 2), Math.min(frames.length, i + 3));
    const mids = win.map(w => w.midi).filter((m): m is number => typeof m === 'number');
    const m = mids.length ? Math.round(median(mids)) : null;
    smoothed.push({ ...frames[i]!, midi: m });
  }

  return smoothed;
}

export function StudioAudioToMidiModal({
  open,
  onClose,
  onSuccess,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (notes: NoteEvent[]) => void;
  mode: Mode;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('Preparing…');
  const [bpmHint, setBpmHint] = useState<number>(128);

  const canUse = mode === 'studio';

  const reset = useCallback(() => {
    setDragOver(false);
    setFileName(null);
    setError(null);
    setLoading(false);
    setProgress('Preparing…');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const disclaimer = useMemo(
    () => 'Works best with single-instrument melodic audio. Polyphonic audio (full mixes) may produce inaccurate results.',
    [],
  );

  const processFile = useCallback(async (file: File) => {
    if (!canUse) return;
    setError(null);
    setFileName(file.name);

    if (!extOk(file.name)) {
      setError('Use a .wav or .mp3 file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Max file size is 10 MB.');
      return;
    }

    setLoading(true);
    setProgress('Decoding audio…');

    try {
      const audio = await decodeAudioFile(file);
      if (audio.duration > MAX_SECONDS) {
        setError(`Max duration is ${MAX_SECONDS}s on Studio.`);
        return;
      }

      const sr = audio.sampleRate;
      const maxSamples = Math.min(audio.length, Math.floor(sr * MAX_SECONDS));
      const mono = mixToMono(audio, maxSamples);

      setProgress('Detecting pitch… 0%');
      const frames = guessMonophonicPitchFrames({
        mono,
        sampleRate: sr,
        bpm: bpmHint,
        setProgress,
      });

      setProgress('Building notes…');
      const notes = buildNotesFromFrames({ frames, bpm: bpmHint })
        // trim nonsense (very tiny notes)
        .filter(n => n.duration >= 0.08);

      setProgress(`Done — ${notes.length} notes`);
      onSuccess(notes);
      handleClose();
    } catch {
      setError('Audio to MIDI failed.');
    } finally {
      setLoading(false);
    }
  }, [bpmHint, canUse, handleClose, onSuccess, setProgress]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void processFile(f);
    },
    [processFile],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[85]"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            className="fixed left-1/2 top-1/2 z-[86] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16 }}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="a2m-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="a2m-title" className="text-lg font-bold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                  Audio to MIDI
                </h2>
                <p className="mt-1 text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: MUTED }}>
                  {disclaimer}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-2 py-1 text-sm"
                style={{ color: MUTED, background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {!canUse && (
              <div className="mb-5 rounded-xl p-4" style={{ border: `1px solid ${DASH}`, background: 'rgba(9,9,11,0.35)' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}>
                  Studio plan required
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', color: MUTED, fontSize: 13 }}>
                  Upgrade to Studio to convert audio to editable MIDI.
                </p>
              </div>
            )}

            <div
              className="mb-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
              style={{
                borderColor: dragOver ? ACCENT : DASH,
                background: 'rgba(9,9,11,0.35)',
                opacity: canUse ? 1 : 0.55,
                cursor: canUse ? 'pointer' : 'not-allowed',
              }}
              onDragOver={e => {
                if (!canUse) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => {
                if (!canUse || loading) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/mpeg,audio/mp3,audio/wav';
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) void processFile(f);
                };
                input.click();
              }}
            >
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: MUTED }}>
                Drag & drop .wav / .mp3 (max 10 MB, max 30s)
              </p>
              {fileName && (
                <p className="mt-2 text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)' }}>
                  {fileName}
                </p>
              )}
            </div>

            <div className="mb-4 flex items-center justify-between gap-3">
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: MUTED }}>
                BPM hint
              </span>
              <input
                type="number"
                min={60}
                max={200}
                value={bpmHint}
                disabled={!canUse || loading}
                onChange={e => setBpmHint(clamp(parseInt(e.target.value || '128', 10), 60, 200))}
                className="input-field"
                style={{ width: 120, height: 40, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
              />
            </div>

            {error && (
              <p className="mb-4 text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: ACCENT }}>
                {error}
              </p>
            )}

            {loading && (
              <p className="mb-4 text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                {progress}
              </p>
            )}

            <button
              type="button"
              disabled={!canUse || loading}
              className="w-full rounded-xl py-4 text-base font-semibold transition-opacity disabled:opacity-40"
              style={{ background: ACCENT, color: CTA_TEXT, fontFamily: 'DM Sans, sans-serif' }}
              onClick={() => {
                // no-op; user picks a file via drop/click
              }}
              title={canUse ? 'Choose a file above' : 'Studio plan required'}
            >
              {loading ? 'Processing…' : 'Choose audio file above'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

