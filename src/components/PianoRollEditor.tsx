'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteEvent } from '@/lib/music-engine';

export interface PianoRollEditorProps {
  notes: NoteEvent[];
  color: string;
  bars: number;
  layerName: string;
  onNotesChange: (notes: NoteEvent[]) => void;
  isPlaying?: boolean;
  playheadBeat?: number;
  gridHeightPx?: number;
  velocityHeightPx?: number;
  chordOverlayNotes?: NoteEvent[];
}

const MIDI_MIN = 36;
const MIDI_MAX = 84;
const PITCH_ROWS = MIDI_MAX - MIDI_MIN;
const PIANO_W = 48;
const GRID_H_DEFAULT = 240;
const VELOCITY_H_DEFAULT = 80;
const MIN_PX_PER_BEAT = 40;
const MAX_PX_PER_BEAT = 200;
const DEF_PX_PER_BEAT = 80;
const RESIZE_EDGE = 8;
const MIN_NOTE_RENDER_W = 6;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const BG = '#0A0A0F';
const SURFACE = '#111118';
const PRIMARY = '#FF6D3F';
const MUTED = '#8A8A9A';
const CHORD_H = 24;

const CHORD_QUALITY: Record<string, string> = {
  '0,3,7': 'm',
  '0,4,7': 'maj',
  '0,3,6': 'dim',
  '0,4,8': 'aug',
  '0,3,7,10': 'm7',
  '0,4,7,10': '7',
  '0,4,7,11': 'maj7',
  '0,3,7,11': 'm(maj7)',
  '0,2,7': 'sus2',
  '0,5,7': 'sus4',
};

function pcsToChordName(pcs: number[]): string | null {
  if (pcs.length < 3) return null;
  const uniq = [...new Set(pcs.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  if (uniq.length < 3) return null;
  for (const root of uniq) {
    const intervals = uniq.map(c => (c - root + 12) % 12).sort((a, b) => a - b);
    const key = intervals.join(',');
    const q = CHORD_QUALITY[key];
    if (!q) continue;
    const rootName = NOTE_NAMES[root] ?? 'C';
    if (q === 'maj') return rootName;
    if (q === 'm(maj7)') return `${rootName}mMaj7`;
    return `${rootName}${q}`;
  }
  return null;
}

type SnapStep = 0.25 | 0.125 | 0.0625 | 0.03125;

const SNAP_OPTIONS: { label: string; step: SnapStep }[] = [
  { label: '1/4', step: 0.25 },
  { label: '1/8', step: 0.125 },
  { label: '1/16', step: 0.0625 },
  { label: '1/32', step: 0.03125 },
];

function noteKey(n: NoteEvent): string {
  return `${n.pitch}|${n.startTime}|${n.duration}|${n.velocity}`;
}

function pitchLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc] ?? 'C'}${oct}`;
}

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function snapBeat(t: number, step: SnapStep): number {
  return Math.round(t / step) * step;
}

function clampVel(v: number): number {
  return Math.max(0, Math.min(127, Math.round(v)));
}

function usePreviewAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((midi: number) => {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(midi);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
    osc.addEventListener('ended', () => {
      osc.disconnect();
      g.disconnect();
    });
  }, []);
}

type DragState =
  | { mode: 'none' }
  | {
      mode: 'move';
      startX: number;
      startY: number;
      snapshot: NoteEvent[];
      indices: number[];
    }
  | {
      mode: 'resize';
      startX: number;
      snapshot: NoteEvent[];
      index: number;
    }
  | {
      mode: 'rubber';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      moved: boolean;
    }
  | {
      mode: 'vel';
      snapshot: NoteEvent[];
      index: number;
      indices: number[];
      anchorVelocity: number;
    }
  | {
      mode: 'pendingAdd';
      x: number;
      y: number;
      moved: boolean;
    };

export function PianoRollEditor({
  notes,
  color,
  bars,
  layerName,
  onNotesChange,
  isPlaying = false,
  playheadBeat = 0,
  gridHeightPx,
  velocityHeightPx,
  chordOverlayNotes,
}: PianoRollEditorProps) {
  const totalBeats = bars * 4;
  const GRID_H = gridHeightPx ?? GRID_H_DEFAULT;
  const VELOCITY_H = velocityHeightPx ?? VELOCITY_H_DEFAULT;
  const [pxPerBeat, setPxPerBeat] = useState(DEF_PX_PER_BEAT);
  const [snapStep, setSnapStep] = useState<SnapStep>(0.0625);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverVelIdx, setHoverVelIdx] = useState<number | null>(null);
  const [velTooltip, setVelTooltip] = useState<{ x: number; y: number; v: number } | null>(null);
  const [showChords, setShowChords] = useState(true);

  const historyRef = useRef<NoteEvent[][]>([]);
  const futureRef = useRef<NoteEvent[][]>([]);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const velCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({ mode: 'none' });
  const playPreview = usePreviewAudio();

  const wPx = Math.max(320, totalBeats * pxPerBeat);
  const rowH = GRID_H / PITCH_ROWS;

  const commitHistory = useCallback((snapshot: NoteEvent[]) => {
    historyRef.current.push(snapshot.map(n => ({ ...n })));
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const undoCount = historyRef.current.length;
  const redoCount = futureRef.current.length;

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h.pop()!;
    futureRef.current.push(notesRef.current.map(n => ({ ...n })));
    onNotesChange(prev);
    setSelectedKeys(new Set());
  }, [onNotesChange]);

  const redo = useCallback(() => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const nxt = f.pop()!;
    historyRef.current.push(notesRef.current.map(n => ({ ...n })));
    onNotesChange(nxt);
  }, [onNotesChange]);

  const hitTestNote = useCallback(
    (x: number, y: number, list: NoteEvent[], widthPx: number): { index: number; edge: 'resize' | 'body' } | null => {
      for (let i = list.length - 1; i >= 0; i--) {
        const note = list[i]!;
        if (note.pitch < MIDI_MIN || note.pitch >= MIDI_MAX) continue;
        const pi = MIDI_MAX - 1 - note.pitch;
        const nx = (note.startTime / totalBeats) * widthPx;
        let nw = (note.duration / totalBeats) * widthPx;
        nw = Math.max(MIN_NOTE_RENDER_W, nw);
        const ny = pi * rowH;
        if (x >= nx && x <= nx + nw && y >= ny && y < ny + rowH) {
          const edge = x >= nx + nw - RESIZE_EDGE ? 'resize' : 'body';
          return { index: i, edge };
        }
      }
      return null;
    },
    [totalBeats, rowH],
  );

  const drawGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wPx;
    const h = GRID_H;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < PITCH_ROWS; i++) {
      const pitch = MIDI_MAX - 1 - i;
      if ([1, 3, 6, 8, 10].includes(pitch % 12)) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, i * rowH, w, rowH);
      }
    }

    for (let i = 0; i <= PITCH_ROWS; i++) {
      const pitch = MIDI_MAX - 1 - i;
      const y = i * rowH;
      const isC = pitch % 12 === 0;
      ctx.strokeStyle = isC ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.035)';
      ctx.lineWidth = isC ? 0.9 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = (beat / totalBeats) * w;
      const isBar = beat % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const subDivs = totalBeats * 4;
    for (let s = 1; s < subDivs; s++) {
      if (s % 4 === 0) continue;
      const x = (s / 4 / totalBeats) * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const rubber = dragRef.current.mode === 'rubber' ? dragRef.current : null;
    if (rubber) {
      const rx1 = Math.min(rubber.x1, rubber.x2);
      const ry1 = Math.min(rubber.y1, rubber.y2);
      const rw = Math.abs(rubber.x2 - rubber.x1);
      const rh = Math.abs(rubber.y2 - rubber.y1);
      ctx.strokeStyle = 'rgba(255,109,63,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx1, ry1, rw, rh);
      ctx.setLineDash([]);
    }

    const yOff = showChords ? CHORD_H : 0;
    const sorted = [...notes].sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);
    for (const note of sorted) {
      if (note.pitch < MIDI_MIN || note.pitch >= MIDI_MAX) continue;
      const pi = MIDI_MAX - 1 - note.pitch;
      const x0 = (note.startTime / totalBeats) * w;
      let nw = (note.duration / totalBeats) * w;
      nw = Math.max(MIN_NOTE_RENDER_W, nw);
      const y = pi * rowH + 1 + yOff;
      const nh = Math.max(2, rowH - 2);
      const k = noteKey(note);
      const sel = selectedKeys.has(k);
      const vNorm = Math.max(0, Math.min(1, note.velocity / 127));
      const alpha = 0.25 + vNorm * 0.75;
      ctx.globalAlpha = alpha;
      // Slight brightness lift on higher velocities (subtle)
      const bright = 0.75 + vNorm * 0.25;
      ctx.fillStyle = vNorm < 0.5 ? `${color}` : `${color}`;
      const r = Math.min(3, nh / 2, nw / 2);
      ctx.beginPath();
      ctx.moveTo(x0 + r, y);
      ctx.lineTo(x0 + nw - r, y);
      ctx.quadraticCurveTo(x0 + nw, y, x0 + nw, y + r);
      ctx.lineTo(x0 + nw, y + nh - r);
      ctx.quadraticCurveTo(x0 + nw, y + nh, x0 + nw - r, y + nh);
      ctx.lineTo(x0 + r, y + nh);
      ctx.quadraticCurveTo(x0, y + nh, x0, y + nh - r);
      ctx.lineTo(x0, y + r);
      ctx.quadraticCurveTo(x0, y, x0 + r, y);
      ctx.closePath();
      ctx.fill();
      // Overlay highlight for higher velocities without changing base hue.
      if (vNorm > 0.5) {
        ctx.globalAlpha = (vNorm - 0.5) * 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      if (sel) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (nw > 30) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fff';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(pitchLabel(note.pitch), x0 + 4, y + nh / 2 + 3);
      }
      ctx.globalAlpha = 1;
    }

    if (isPlaying) {
      const pb = ((playheadBeat % totalBeats) + totalBeats) % totalBeats;
      const px = (pb / totalBeats) * w;
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
  }, [notes, color, totalBeats, wPx, selectedKeys, isPlaying, playheadBeat, rowH, showChords]);

  const drawVelocity = useCallback(() => {
    const canvas = velCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wPx;
    const h = VELOCITY_H;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = (beat / totalBeats) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const pad = 8;
    const chartH = h - pad * 2;
    const hasSelection = selectedKeys.size > 0;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      const xCenter = (note.startTime / totalBeats) * w;
      const barW = Math.max(4, (note.duration / totalBeats) * w * 0.45);
      const x = xCenter - barW / 2;
      const vh = (note.velocity / 127) * chartH;
      const k = noteKey(note);
      const sel = selectedKeys.has(k);
      if (hasSelection && !sel) continue;
      ctx.fillStyle = sel ? color : `${color}99`;
      ctx.globalAlpha = sel ? 1 : 0.78;
      ctx.fillRect(x, pad + chartH - vh, barW, vh);
      ctx.globalAlpha = 1;
    }
  }, [notes, color, totalBeats, wPx, selectedKeys]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  useEffect(() => {
    drawVelocity();
  }, [drawVelocity]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      drawGrid();
      drawVelocity();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawGrid, drawVelocity]);

  const quantizeAll = () => {
    if (notesRef.current.length === 0) return;
    commitHistory(notesRef.current);
    const next = notes.map(n => {
      const st = snapBeat(n.startTime, snapStep);
      const dur = Math.max(snapStep, snapBeat(n.duration, snapStep));
      const maxDur = totalBeats - st;
      return { ...n, startTime: st, duration: Math.min(dur, maxDur) };
    });
    onNotesChange(next);
  };

  const clearAll = () => {
    if (notesRef.current.length === 0) return;
    commitHistory(notesRef.current);
    onNotesChange([]);
    setSelectedKeys(new Set());
  };

  const onGridMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const list = notesRef.current;
    const hit = hitTestNote(x, y, list, wPx);

    if (hit) {
      const k = noteKey(list[hit.index]!);
      let nextSel: Set<string>;
      if (e.shiftKey) {
        nextSel = new Set(selectedKeys);
        if (nextSel.has(k)) nextSel.delete(k);
        else nextSel.add(k);
      } else if (selectedKeys.has(k)) {
        nextSel = new Set(selectedKeys);
      } else {
        nextSel = new Set([k]);
      }
      setSelectedKeys(nextSel);
      const indices = list.map((n, i) => (nextSel.has(noteKey(n)) ? i : -1)).filter(i => i >= 0);

      if (hit.edge === 'resize') {
        dragRef.current = { mode: 'resize', startX: x, snapshot: list.map(n => ({ ...n })), index: hit.index };
      } else {
        const idxSet = new Set(indices.length ? indices : [hit.index]);
        dragRef.current = {
          mode: 'move',
          startX: x,
          startY: y,
          snapshot: list.map(n => ({ ...n })),
          indices: [...idxSet],
        };
      }
      return;
    }

    if (!e.shiftKey) setSelectedKeys(new Set());
    dragRef.current = { mode: 'pendingAdd', x, y, moved: false };
  };

  const onGridMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = wPx;
    const d = dragRef.current;

    if (d.mode === 'pendingAdd') {
      if (Math.abs(x - d.x) > 3 || Math.abs(y - d.y) > 3) {
        d.moved = true;
        dragRef.current = { mode: 'rubber', x1: d.x, y1: d.y, x2: x, y2: y, moved: true };
      }
      drawGrid();
      return;
    }

    if (d.mode === 'rubber') {
      d.x2 = x;
      d.y2 = y;
      d.moved = true;
      drawGrid();
      return;
    }

    if (d.mode === 'move') {
      const dxBeats = ((x - d.startX) / w) * totalBeats;
      const dPitch = Math.round((d.startY - y) / rowH);
      const next = d.snapshot.map((n, i) => {
        if (!d.indices.includes(i)) return { ...n };
        let st = snapBeat(n.startTime + dxBeats, snapStep);
        let pitch = n.pitch + dPitch;
        pitch = Math.max(MIDI_MIN, Math.min(MIDI_MAX - 1, pitch));
        st = Math.max(0, Math.min(totalBeats - snapStep, st));
        return { ...n, startTime: st, pitch };
      });
      onNotesChange(next);
      return;
    }

    if (d.mode === 'resize') {
      const base = d.snapshot[d.index]!;
      const nx = (base.startTime / totalBeats) * w;
      const durBeats = ((x - nx) / w) * totalBeats;
      let newDur = snapBeat(Math.max(snapStep, durBeats), snapStep);
      newDur = Math.min(newDur, totalBeats - base.startTime);
      const next = d.snapshot.map((n, i) => (i === d.index ? { ...n, duration: newDur } : { ...n }));
      onNotesChange(next);
    }
  };

  const finishGridInteraction = () => {
    const d = dragRef.current;
    if (d.mode === 'rubber') {
      const rx1 = Math.min(d.x1, d.x2);
      const rx2 = Math.max(d.x1, d.x2);
      const ry1 = Math.min(d.y1, d.y2);
      const ry2 = Math.max(d.y1, d.y2);
      if (d.moved && (rx2 - rx1 > 4 || ry2 - ry1 > 4)) {
        const set = new Set<string>();
        for (const n of notesRef.current) {
          if (n.pitch < MIDI_MIN || n.pitch >= MIDI_MAX) continue;
          const pi = MIDI_MAX - 1 - n.pitch;
          const nx = (n.startTime / totalBeats) * wPx;
          const nw = Math.max(MIN_NOTE_RENDER_W, (n.duration / totalBeats) * wPx);
          const ny = pi * rowH;
          const cx = nx + nw / 2;
          const cy = ny + rowH / 2;
          if (cx >= rx1 && cx <= rx2 && cy >= ry1 && cy <= ry2) set.add(noteKey(n));
        }
        setSelectedKeys(set);
      }
      dragRef.current = { mode: 'none' };
      drawGrid();
      return;
    }

    if (d.mode === 'pendingAdd') {
      if (!d.moved) {
        const canvas = gridCanvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const lx = d.x;
          const ly = d.y;
          const list = notesRef.current;
          if (!hitTestNote(lx, ly, list, wPx)) {
            const pi = Math.floor(ly / rowH);
            const pitch = MIDI_MAX - 1 - pi;
            const rawT = (lx / wPx) * totalBeats;
            const st = snapBeat(rawT, snapStep);
            if (pitch >= MIDI_MIN && pitch < MIDI_MAX && st >= 0 && st < totalBeats) {
              commitHistory(list);
              const nn: NoteEvent = { pitch, startTime: st, duration: Math.max(snapStep * 2, snapStep), velocity: 80 };
              onNotesChange([...list, nn]);
              setSelectedKeys(new Set([noteKey(nn)]));
            }
          }
        }
      }
      dragRef.current = { mode: 'none' };
      drawGrid();
      return;
    }

    if (d.mode === 'move' || d.mode === 'resize') {
      const before = JSON.stringify(d.snapshot);
      const after = JSON.stringify(notesRef.current);
      if (before !== after) commitHistory(d.snapshot);
    }
    dragRef.current = { mode: 'none' };
    drawGrid();
  };

  const onGridContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const list = notesRef.current;
    const hit = hitTestNote(x, y, list, wPx);
    if (!hit) return;
    const k = noteKey(list[hit.index]!);
    commitHistory(list);
    onNotesChange(list.filter((_, i) => i !== hit.index));
    setSelectedKeys(prev => {
      const n = new Set(prev);
      n.delete(k);
      return n;
    });
  };

  const onVelMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = velCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = -1;
    let bestD = 1e9;
    for (let i = 0; i < notesRef.current.length; i++) {
      const note = notesRef.current[i]!;
      const xCenter = (note.startTime / totalBeats) * wPx;
      const barW = Math.max(4, (note.duration / totalBeats) * wPx * 0.45);
      const dist = Math.abs(x - xCenter);
      if (dist < barW + 4 && dist < bestD) {
        bestD = dist;
        best = i;
      }
    }
    if (best < 0) return;
    const hitKey = noteKey(notesRef.current[best]!);
    if (!selectedKeys.has(hitKey)) {
      setSelectedKeys(new Set([hitKey]));
    }
    commitHistory(notesRef.current);
    const activeSel = selectedKeys.has(hitKey) ? selectedKeys : new Set([hitKey]);
    const indices = notesRef.current
      .map((n, i) => ({ k: noteKey(n), i }))
      .filter(x => activeSel.has(x.k))
      .map(x => x.i);
    const anchorVelocity = notesRef.current[best]!.velocity;
    dragRef.current = {
      mode: 'vel',
      snapshot: notesRef.current.map(n => ({ ...n })),
      index: best,
      indices,
      anchorVelocity,
    };
  };

  const onVelMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = velCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;
    const d = dragRef.current;
    if (d.mode === 'vel') {
      const chartH = VELOCITY_H - 16;
      const pad = 8;
      const rel = 1 - (y - pad) / chartH;
      const v = clampVel(rel * 127);
      const delta = v - d.anchorVelocity;
      const next = d.snapshot.map((n, i) => {
        if (!d.indices.includes(i)) return { ...n };
        return { ...n, velocity: clampVel(n.velocity + delta) };
      });
      onNotesChange(next);
    }
    let best = -1;
    let bestD = 1e9;
    for (let i = 0; i < notesRef.current.length; i++) {
      const note = notesRef.current[i]!;
      const xCenter = (note.startTime / totalBeats) * wPx;
      const barW = Math.max(4, (note.duration / totalBeats) * wPx * 0.45);
      const dist = Math.abs(x - xCenter);
      if (dist < barW + 6 && dist < bestD) {
        bestD = dist;
        best = i;
      }
    }
    setHoverVelIdx(best >= 0 ? best : null);
    if (best >= 0) {
      setVelTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, v: notesRef.current[best]!.velocity });
    } else setVelTooltip(null);
  };

  const endVelDrag = () => {
    if (dragRef.current.mode === 'vel') dragRef.current = { mode: 'none' };
  };

  const endGlobalDragRef = useRef<() => void>(() => {});

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedKeys.size === 0) return;
      e.preventDefault();
      commitHistory(notesRef.current);
      onNotesChange(notesRef.current.filter(n => !selectedKeys.has(noteKey(n))));
      setSelectedKeys(new Set());
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelectedKeys(new Set(notesRef.current.map(noteKey)));
    }
    const isCombo = e.ctrlKey || e.metaKey;
    if (isCombo && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if (isCombo && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      redo();
    }
  };

  const zoomIn = () => setPxPerBeat(v => Math.min(MAX_PX_PER_BEAT, Math.round(v + 10)));
  const zoomOut = () => setPxPerBeat(v => Math.max(MIN_PX_PER_BEAT, Math.round(v - 10)));

  const chordSegments = useMemo(() => {
    if (!showChords) return [];
    const all = chordOverlayNotes && chordOverlayNotes.length ? chordOverlayNotes : notes;
    if (!all || all.length === 0) return [];

    const segs: Array<{ startBeat: number; endBeat: number; name: string }> = [];
    const beatCount = totalBeats;
    let cur: { startBeat: number; name: string } | null = null;

    const getPcsAtBeat = (b: number): number[] => {
      const pcs: number[] = [];
      const t = b;
      for (const n of all) {
        const st = n.startTime;
        const en = n.startTime + n.duration;
        if (t + 1e-6 >= st && t < en - 1e-6) pcs.push(n.pitch % 12);
      }
      return pcs;
    };

    for (let b = 0; b < beatCount; b++) {
      const name = pcsToChordName(getPcsAtBeat(b)) ?? '—';
      if (!cur) {
        cur = { startBeat: b, name };
        continue;
      }
      if (name === cur.name) continue;
      segs.push({ startBeat: cur.startBeat, endBeat: b, name: cur.name });
      cur = { startBeat: b, name };
    }
    if (cur) segs.push({ startBeat: cur.startBeat, endBeat: beatCount, name: cur.name });

    // Drop long runs of unknowns to reduce noise; keep short dashes for context.
    return segs.filter(s => !(s.name === '—' && s.endBeat - s.startBeat >= 4));
  }, [showChords, chordOverlayNotes, notes, totalBeats]);

  endGlobalDragRef.current = () => {
    finishGridInteraction();
    endVelDrag();
  };

  useEffect(() => {
    const up = () => endGlobalDragRef.current();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const pianoKeys = useMemo(() => {
    const rows: { midi: number; isBlack: boolean }[] = [];
    for (let m = MIDI_MAX - 1; m >= MIDI_MIN; m--) {
      rows.push({ midi: m, isBlack: [1, 3, 6, 8, 10].includes(m % 12) });
    }
    return rows;
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="outline-none rounded-lg overflow-hidden border border-[#1A1A2E] flex flex-col focus:ring-1 focus:ring-[#FF6D3F]/40"
      style={{ background: SURFACE }}
      onMouseDown={() => containerRef.current?.focus()}
      onKeyDown={onKeyDown}
    >
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#1A1A2E] shrink-0"
        style={{ background: '#0D0D12', minHeight: 40 }}
      >
        <span className="text-[10px] uppercase tracking-wider font-mono" style={{ color: MUTED }}>
          {layerName}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="relative px-2 h-7 rounded-md text-xs font-mono border transition-colors"
            style={{
              borderColor: undoCount > 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
              color: undoCount > 0 ? '#F0F0FF' : 'rgba(138,138,154,0.6)',
              opacity: undoCount > 0 ? 1 : 0.55,
              cursor: undoCount > 0 ? 'pointer' : 'not-allowed',
            }}
            onClick={() => {
              if (undoCount === 0) return;
              undo();
            }}
            title="Undo (Ctrl/Cmd+Z)"
          >
            ↶
            {undoCount > 0 && (
              <span
                className="absolute -right-1 -top-1 rounded px-1 text-[9px] font-mono"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(240,240,255,0.9)' }}
              >
                {Math.min(99, undoCount)}
              </span>
            )}
          </button>
          <button
            type="button"
            className="relative px-2 h-7 rounded-md text-xs font-mono border transition-colors"
            style={{
              borderColor: redoCount > 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
              color: redoCount > 0 ? '#F0F0FF' : 'rgba(138,138,154,0.6)',
              opacity: redoCount > 0 ? 1 : 0.55,
              cursor: redoCount > 0 ? 'pointer' : 'not-allowed',
            }}
            onClick={() => {
              if (redoCount === 0) return;
              redo();
            }}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            ↷
            {redoCount > 0 && (
              <span
                className="absolute -right-1 -top-1 rounded px-1 text-[9px] font-mono"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(240,240,255,0.9)' }}
              >
                {Math.min(99, redoCount)}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2 h-7 rounded-md text-xs font-mono border border-white/10 hover:border-[#FF6D3F]/50 text-[#8A8A9A] hover:text-white transition-colors"
            onClick={zoomOut}
          >
            −
          </button>
          <button
            type="button"
            className="px-2 h-7 rounded-md text-xs font-mono border border-white/10 hover:border-[#FF6D3F]/50 text-[#8A8A9A] hover:text-white transition-colors"
            onClick={zoomIn}
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-mono" style={{ color: MUTED }}>
            Snap
          </span>
          {SNAP_OPTIONS.map(o => (
            <button
              key={o.label}
              type="button"
              className={`px-2 h-7 rounded-md text-[10px] font-mono border transition-colors ${
                snapStep === o.step ? 'border-[#FF6D3F]/60 text-[#FF6D3F] bg-[#FF6D3F]/10' : 'border-white/10 text-[#8A8A9A] hover:text-white'
              }`}
              onClick={() => setSnapStep(o.step)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="px-2 h-7 rounded-md text-[10px] font-mono border border-white/10 hover:border-[#FF6D3F]/50 text-[#8A8A9A] hover:text-white transition-colors"
          onClick={quantizeAll}
        >
          Quantize
        </button>
        <button
          type="button"
          className="px-2 h-7 rounded-md text-[10px] font-mono border border-red-500/30 text-red-400/90 hover:bg-red-500/10 transition-colors"
          onClick={clearAll}
        >
          Clear all
        </button>
        <button
          type="button"
          className="px-2 h-7 rounded-md text-[10px] font-mono border transition-colors"
          style={{
            borderColor: showChords ? 'rgba(255,109,63,0.45)' : 'rgba(255,255,255,0.10)',
            color: showChords ? '#FF6D3F' : '#8A8A9A',
            background: showChords ? 'rgba(255,109,63,0.10)' : 'transparent',
          }}
          onClick={() => setShowChords(v => !v)}
          title="Toggle chord overlay"
        >
          Chords
        </button>
      </div>

      <div className="flex flex-1 min-h-0 min-w-0">
        <div
          className="shrink-0 border-r border-[#1A1A2E] relative select-none"
          style={{ width: PIANO_W, height: GRID_H, background: BG }}
        >
          {showChords && (
            <div
              className="absolute left-0 top-0 w-full border-b border-[#1A1A2E]"
              style={{ height: CHORD_H, background: '#0D0D12' }}
            />
          )}
          {pianoKeys.map(({ midi, isBlack }) => {
            const row = MIDI_MAX - 1 - midi;
            const top = (row / PITCH_ROWS) * GRID_H + (showChords ? CHORD_H : 0);
            const h = GRID_H / PITCH_ROWS;
            const isC = midi % 12 === 0;
            const label = isC ? pitchLabel(midi) : '';
            const hk = `k${midi}`;
            const hover = hoverKey === hk;
            if (isBlack) {
              const bw = PIANO_W * 0.6;
              return (
                <button
                  key={hk}
                  type="button"
                  className="absolute z-10 border border-black/60 rounded-sm"
                  style={{
                    left: PIANO_W - bw,
                    top: top - h * 0.28,
                    width: bw,
                    height: h * 1.55,
                    background: hover ? '#2a2a38' : '#15151d',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.55)',
                  }}
                  onMouseEnter={() => setHoverKey(hk)}
                  onMouseLeave={() => setHoverKey(null)}
                  onClick={() => playPreview(midi)}
                  aria-label={pitchLabel(midi)}
                />
              );
            }
            return (
              <button
                key={hk}
                type="button"
                className="absolute left-0 border-b flex items-end justify-center pb-0.5 text-[8px] font-mono leading-none"
                style={{
                  top,
                  width: PIANO_W,
                  height: h,
                  background: hover ? '#e8e8f0' : '#f4f4f8',
                  color: isC ? '#333' : 'transparent',
                  borderColor: 'rgba(0,0,0,0.1)',
                }}
                onMouseEnter={() => setHoverKey(hk)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => playPreview(midi)}
                aria-label={pitchLabel(midi)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden min-w-0" style={{ background: BG }}>
          <div style={{ width: wPx, minWidth: '100%' }}>
            {showChords && (
              <div
                className="relative border-b border-[#1A1A2E]"
                style={{ height: CHORD_H, background: '#0D0D12' }}
              >
                {chordSegments.map(seg => {
                  const left = (seg.startBeat / totalBeats) * wPx;
                  const width = ((seg.endBeat - seg.startBeat) / totalBeats) * wPx;
                  if (width < 14) return null;
                  return (
                    <div
                      key={`${seg.startBeat}-${seg.name}`}
                      className="absolute top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-mono"
                      style={{
                        left,
                        width,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: seg.name === '—' ? 'rgba(138,138,154,0.55)' : 'rgba(240,240,255,0.92)',
                      }}
                    >
                      <span
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          background: seg.name === '—' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {seg.name === '—' ? '—' : seg.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <canvas
              ref={gridCanvasRef}
              className="block cursor-crosshair touch-none"
              style={{ height: GRID_H }}
              onMouseDown={onGridMouseDown}
              onMouseMove={e => {
                onGridMouseMove(e);
                drawGrid();
              }}
              onMouseUp={finishGridInteraction}
              onMouseLeave={() => {
                finishGridInteraction();
              }}
              onContextMenu={onGridContextMenu}
            />
            <div className="relative border-t border-[#1A1A2E]">
              <canvas
                ref={velCanvasRef}
                className="block cursor-ns-resize"
                style={{ height: VELOCITY_H }}
                onMouseDown={onVelMouseDown}
                onMouseMove={onVelMouseMove}
                onMouseUp={endVelDrag}
                onMouseLeave={() => {
                  endVelDrag();
                  setHoverVelIdx(null);
                  setVelTooltip(null);
                }}
              />
              {velTooltip && hoverVelIdx != null && (
                <div
                  className="pointer-events-none absolute z-20 px-1.5 py-0.5 rounded text-[10px] font-mono border border-white/20"
                  style={{
                    left: Math.min(wPx - 56, velTooltip.x + 8),
                    top: velTooltip.y - 24,
                    background: '#111118',
                    color: '#fff',
                  }}
                >
                  vel {velTooltip.v}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="px-3 py-1.5 text-[9px] font-mono border-t border-[#1A1A2E]" style={{ color: 'rgba(138,138,154,0.45)' }}>
        Del remove · Shift+click multi · drag · right edge resize · RMB delete · Ctrl+A · Ctrl+Z / Ctrl+Shift+Z redo
      </p>
    </div>
  );
}
