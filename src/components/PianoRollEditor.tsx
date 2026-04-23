'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteEvent } from '@/lib/music-engine';
import { readCssColor } from '@/lib/design-system';

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
  chordStripVisible?: boolean;
  onChordStripVisibleChange?: (visible: boolean) => void;
}

const MIDI_MIN = 36;
const MIDI_MAX = 84;
const PITCH_ROWS = MIDI_MAX - MIDI_MIN;
const PIANO_W = 64;
const GRID_H_DEFAULT = 240;
const VELOCITY_H_DEFAULT = 80;
const MIN_PX_PER_BEAT = 24;
const MAX_PX_PER_BEAT = 400;
const DEF_PX_PER_BEAT = 80;
const RESIZE_EDGE = 8;
const MIN_NOTE_RENDER_W = 4;
const CHORD_H = 24;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const PRIMARY = '#FF6D3F';

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
    const q = CHORD_QUALITY[intervals.join(',')];
    if (!q) continue;
    const rootName = NOTE_NAMES[root] ?? 'C';
    if (q === 'maj') return rootName;
    if (q === 'm(maj7)') return `${rootName}mMaj7`;
    return `${rootName}${q}`;
  }
  return null;
}

// snap steps are in beats (quarter notes): 4=whole, 2=half, 1=quarter, 0.5=8th, 0.25=16th, 0.125=32nd
type SnapStep = 4 | 2 | 1 | 0.5 | 0.25 | 0.125;

const SNAP_OPTIONS: { label: string; step: SnapStep }[] = [
  { label: '1/1', step: 4 },
  { label: '1/2', step: 2 },
  { label: '1/4', step: 1 },
  { label: '1/8', step: 0.5 },
  { label: '1/16', step: 0.25 },
  { label: '1/32', step: 0.125 },
];

type Tool = 'draw' | 'select';

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
    const Ctx =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(midi);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);
    osc.addEventListener('ended', () => {
      osc.disconnect();
      gain.disconnect();
    });
  }, []);
}

type DragState =
  | { mode: 'none' }
  | { mode: 'move'; startX: number; startY: number; snapshot: NoteEvent[]; indices: number[] }
  | { mode: 'resize'; startX: number; snapshot: NoteEvent[]; index: number }
  | { mode: 'rubber'; x1: number; y1: number; x2: number; y2: number; moved: boolean }
  | { mode: 'vel'; snapshot: NoteEvent[]; index: number; indices: number[]; anchorVelocity: number }
  | { mode: 'pendingAdd'; x: number; y: number; moved: boolean };

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
  chordStripVisible: chordStripVisibleProp,
  onChordStripVisibleChange,
}: PianoRollEditorProps) {
  const totalBeats = bars * 4;
  const GRID_H = gridHeightPx ?? GRID_H_DEFAULT;
  const VELOCITY_H = velocityHeightPx ?? VELOCITY_H_DEFAULT;

  const [pxPerBeat, setPxPerBeat] = useState(DEF_PX_PER_BEAT);
  const [snapStep, setSnapStep] = useState<SnapStep>(0.25);
  const [tool, setTool] = useState<Tool>('draw');
  const [velExpanded, setVelExpanded] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverVelIdx, setHoverVelIdx] = useState<number | null>(null);
  const [velTooltip, setVelTooltip] = useState<{ x: number; y: number; v: number } | null>(null);
  const [chordStripInternal, setChordStripInternal] = useState(true);
  const [compactChords, setCompactChords] = useState(false);

  const chordControlled = chordStripVisibleProp !== undefined;
  const showChords = chordControlled ? chordStripVisibleProp : chordStripInternal;

  const toggleChordStrip = useCallback(() => {
    if (chordControlled && onChordStripVisibleChange) {
      onChordStripVisibleChange(!showChords);
    } else {
      setChordStripInternal(v => !v);
    }
  }, [chordControlled, onChordStripVisibleChange, showChords]);

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
    if (!h.length) return;
    const prev = h.pop()!;
    futureRef.current.push(notesRef.current.map(n => ({ ...n })));
    onNotesChange(prev);
    setSelectedKeys(new Set());
  }, [onNotesChange]);

  const redo = useCallback(() => {
    const f = futureRef.current;
    if (!f.length) return;
    const nxt = f.pop()!;
    historyRef.current.push(notesRef.current.map(n => ({ ...n })));
    onNotesChange(nxt);
  }, [onNotesChange]);

  const hitTestNote = useCallback(
    (x: number, y: number, list: NoteEvent[]): { index: number; edge: 'resize' | 'body' } | null => {
      for (let i = list.length - 1; i >= 0; i--) {
        const note = list[i]!;
        if (note.pitch < MIDI_MIN || note.pitch >= MIDI_MAX) continue;
        const pi = MIDI_MAX - 1 - note.pitch;
        const nx = (note.startTime / totalBeats) * wPx;
        const nw = Math.max(MIN_NOTE_RENDER_W, (note.duration / totalBeats) * wPx);
        const ny = pi * rowH;
        if (x >= nx && x <= nx + nw && y >= ny && y < ny + rowH) {
          return { index: i, edge: x >= nx + nw - RESIZE_EDGE ? 'resize' : 'body' };
        }
      }
      return null;
    },
    [totalBeats, wPx, rowH],
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

    const R = (name: string, fb: string) => readCssColor(name, fb);

    // Background
    ctx.fillStyle = R('--piano-roll-bg', '#0C0C0D');
    ctx.fillRect(0, 0, w, h);

    // Row backgrounds — black key rows darker (FL Studio style)
    for (let i = 0; i < PITCH_ROWS; i++) {
      const pitch = MIDI_MAX - 1 - i;
      if (BLACK_PCS.has(pitch % 12)) {
        ctx.fillStyle = R('--piano-roll-key-shade', 'rgba(0,0,0,0.30)');
        ctx.fillRect(0, i * rowH, w, rowH);
      }
    }

    // Horizontal row lines
    for (let i = 0; i <= PITCH_ROWS; i++) {
      const pitch = MIDI_MAX - 1 - i;
      const y = i * rowH;
      const isC = pitch % 12 === 0;
      const isE = pitch % 12 === 4;
      ctx.strokeStyle = isC
        ? R('--piano-roll-row-c', 'rgba(255,255,255,0.14)')
        : isE
          ? R('--piano-roll-row-n', 'rgba(255,255,255,0.07)')
          : R('--piano-roll-row-n', 'rgba(255,255,255,0.04)');
      ctx.lineWidth = isC ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical grid lines — three tiers: subdivisions, beats, bars
    // Subdivision lines (snap step resolution)
    const snapPx = snapStep * pxPerBeat;
    if (snapPx >= 6) {
      const subCount = Math.ceil(w / snapPx) + 1;
      ctx.strokeStyle = R('--piano-roll-subdiv', 'rgba(255,255,255,0.04)');
      ctx.lineWidth = 0.5;
      for (let s = 0; s * snapPx <= w; s++) {
        const beat = s * snapStep;
        if (beat % 1 < 1e-9 || 1 - (beat % 1) < 1e-9) continue; // skip beat/bar lines
        const x = s * snapPx;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      void subCount;
    }

    // Beat lines
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = (beat / totalBeats) * w;
      const isBar = beat % 4 === 0;
      if (isBar) continue;
      ctx.strokeStyle = R('--piano-roll-beat-sub', 'rgba(255,255,255,0.09)');
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Bar lines
    for (let bar = 0; bar <= bars; bar++) {
      const x = (bar * 4 / totalBeats) * w;
      ctx.strokeStyle = R('--piano-roll-beat-bar', 'rgba(255,255,255,0.22)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Rubber-band selection rect
    const rubber = dragRef.current.mode === 'rubber' ? dragRef.current : null;
    if (rubber) {
      const rx1 = Math.min(rubber.x1, rubber.x2);
      const ry1 = Math.min(rubber.y1, rubber.y2);
      const rw = Math.abs(rubber.x2 - rubber.x1);
      const rh = Math.abs(rubber.y2 - rubber.y1);
      ctx.fillStyle = 'rgba(255,109,63,0.07)';
      ctx.fillRect(rx1, ry1, rw, rh);
      ctx.strokeStyle = 'rgba(255,109,63,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx1, ry1, rw, rh);
      ctx.setLineDash([]);
    }

    // Notes
    const resolvedColor = (() => {
      const m = String(color ?? '').match(/var\((--[^)]+)\)/);
      if (!m) return color;
      return R(m[1]!, color);
    })();

    for (const note of notes) {
      if (note.pitch < MIDI_MIN || note.pitch >= MIDI_MAX) continue;
      const pi = MIDI_MAX - 1 - note.pitch;
      const x0 = (note.startTime / totalBeats) * w;
      const nw = Math.max(MIN_NOTE_RENDER_W, (note.duration / totalBeats) * w);
      const y = pi * rowH + 1;
      const nh = Math.max(2, rowH - 2);
      const k = noteKey(note);
      const sel = selectedKeys.has(k);
      const r = Math.min(3, nh / 2, nw / 2);

      // Note body at 85% opacity
      ctx.globalAlpha = sel ? 1.0 : 0.85;
      ctx.fillStyle = sel ? lightenHex(resolvedColor, 0.25) : resolvedColor;

      ctx.beginPath();
      if (nw > r * 2 && nh > r * 2) {
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
      } else {
        ctx.rect(x0, y, nw, nh);
      }
      ctx.fill();

      if (sel) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Note label for wide notes
      if (nw > 28 && nh >= 8) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.min(10, nh - 2)}px JetBrains Mono, monospace`;
        ctx.fillText(pitchLabel(note.pitch), x0 + 4, y + nh / 2 + 3.5);
      }
      ctx.globalAlpha = 1;
    }

    // Playhead — always shown when playing
    if (isPlaying) {
      const pb = ((playheadBeat % totalBeats) + totalBeats) % totalBeats;
      const px = (pb / totalBeats) * w;
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      // Playhead triangle cap
      ctx.fillStyle = PRIMARY;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(px - 5, 0);
      ctx.lineTo(px + 5, 0);
      ctx.lineTo(px, 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [notes, color, totalBeats, wPx, bars, snapStep, pxPerBeat, selectedKeys, isPlaying, playheadBeat, rowH]);

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
    const R = (name: string, fb: string) => readCssColor(name, fb);

    ctx.fillStyle = R('--piano-roll-surface', '#0A0A0B');
    ctx.fillRect(0, 0, w, h);

    // Beat guides
    ctx.strokeStyle = R('--piano-roll-vel-border', 'rgba(255,255,255,0.06)');
    ctx.lineWidth = 0.5;
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

    const resolvedColor = (() => {
      const m = String(color ?? '').match(/var\((--[^)]+)\)/);
      if (!m) return color;
      return R(m[1]!, color);
    })();

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      const xCenter = (note.startTime / totalBeats) * w;
      const barW = Math.max(3, Math.min(12, (note.duration / totalBeats) * w * 0.6));
      const x = xCenter - barW / 2;
      const vh = Math.max(2, (note.velocity / 127) * chartH);
      const k = noteKey(note);
      const sel = selectedKeys.has(k);
      const isHov = i === hoverVelIdx;
      if (hasSelection && !sel) {
        ctx.globalAlpha = 0.25;
      } else {
        ctx.globalAlpha = isHov ? 1 : 0.8;
      }
      ctx.fillStyle = resolvedColor;
      ctx.fillRect(x, pad + chartH - vh, barW, vh);

      // Top cap highlight
      if (sel || isHov) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, pad + chartH - vh, barW, 2);
      }
      ctx.globalAlpha = 1;
    }
  }, [notes, color, totalBeats, wPx, selectedKeys, hoverVelIdx]);

  useEffect(() => { drawGrid(); }, [drawGrid]);
  useEffect(() => { drawVelocity(); }, [drawVelocity]);

  useEffect(() => {
    const mo = new MutationObserver(() => { drawGrid(); drawVelocity(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [drawGrid, drawVelocity]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { drawGrid(); drawVelocity(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawGrid, drawVelocity]);

  // Compact chord label detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCompactChords(el.clientWidth > 0 && el.clientWidth < 420);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl+scroll horizontal zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY;
      setPxPerBeat(v => Math.max(MIN_PX_PER_BEAT, Math.min(MAX_PX_PER_BEAT, v + delta * 0.5)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const displayChordName = useCallback(
    (name: string) => (compactChords ? name.replace('mMaj7', 'mM7') : name),
    [compactChords],
  );

  const quantizeAll = () => {
    if (!notesRef.current.length) return;
    commitHistory(notesRef.current);
    const next = notes.map(n => {
      const st = snapBeat(n.startTime, snapStep);
      const dur = Math.max(snapStep, snapBeat(n.duration, snapStep));
      return { ...n, startTime: st, duration: Math.min(dur, totalBeats - st) };
    });
    onNotesChange(next);
  };

  const clearAll = () => {
    if (!notesRef.current.length) return;
    commitHistory(notesRef.current);
    onNotesChange([]);
    setSelectedKeys(new Set());
  };

  const coordsFromEvent = (clientX: number, clientY: number) => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const velCoordsFromEvent = (clientX: number, clientY: number) => {
    const canvas = velCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top, rect };
  };

  const onGridPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button === 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = coordsFromEvent(e.clientX, e.clientY);
    if (!pos) return;
    const { x, y } = pos;
    const list = notesRef.current;
    const hit = hitTestNote(x, y, list);

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
        const idxSet = new Set([...indices, hit.index]);
        dragRef.current = { mode: 'move', startX: x, startY: y, snapshot: list.map(n => ({ ...n })), indices: [...idxSet] };
      }
      return;
    }

    // In draw mode: create note. In select mode: rubber-band.
    if (!e.shiftKey) setSelectedKeys(new Set());
    if (tool === 'draw') {
      dragRef.current = { mode: 'pendingAdd', x, y, moved: false };
    } else {
      dragRef.current = { mode: 'rubber', x1: x, y1: y, x2: x, y2: y, moved: false };
    }
  };

  const onGridPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = coordsFromEvent(e.clientX, e.clientY);
    if (!pos) return;
    const { x, y } = pos;
    const d = dragRef.current;

    if (d.mode === 'pendingAdd') {
      if (Math.abs(x - d.x) > 3 || Math.abs(y - d.y) > 3) {
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
      const dxBeats = ((x - d.startX) / wPx) * totalBeats;
      const dPitch = Math.round((d.startY - y) / rowH);
      const next = d.snapshot.map((n, i) => {
        if (!d.indices.includes(i)) return { ...n };
        const st = Math.max(0, Math.min(totalBeats - snapStep, snapBeat(n.startTime + dxBeats, snapStep)));
        const pitch = Math.max(MIDI_MIN, Math.min(MIDI_MAX - 1, n.pitch + dPitch));
        return { ...n, startTime: st, pitch };
      });
      onNotesChange(next);
      return;
    }

    if (d.mode === 'resize') {
      const base = d.snapshot[d.index]!;
      const nx = (base.startTime / totalBeats) * wPx;
      const durBeats = ((x - nx) / wPx) * totalBeats;
      const newDur = Math.min(
        Math.max(snapStep, snapBeat(durBeats, snapStep)),
        totalBeats - base.startTime,
      );
      const next = d.snapshot.map((n, i) => (i === d.index ? { ...n, duration: newDur } : { ...n }));
      onNotesChange(next);
    }
  };

  const finishGridInteraction = useCallback(() => {
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
          const cx = nx + nw / 2;
          const cy = pi * rowH + rowH / 2;
          if (cx >= rx1 && cx <= rx2 && cy >= ry1 && cy <= ry2) set.add(noteKey(n));
        }
        setSelectedKeys(set);
      }
      dragRef.current = { mode: 'none' };
      drawGrid();
      return;
    }

    if (d.mode === 'pendingAdd') {
      const canvas = gridCanvasRef.current;
      if (canvas && !hitTestNote(d.x, d.y, notesRef.current)) {
        const pi = Math.floor(d.y / rowH);
        const pitch = MIDI_MAX - 1 - pi;
        const st = Math.max(0, Math.min(totalBeats - snapStep, snapBeat((d.x / wPx) * totalBeats, snapStep)));
        if (pitch >= MIDI_MIN && pitch < MIDI_MAX) {
          commitHistory(notesRef.current);
          const nn: NoteEvent = { pitch, startTime: st, duration: snapStep, velocity: 80 };
          onNotesChange([...notesRef.current, nn]);
          setSelectedKeys(new Set([noteKey(nn)]));
          playPreview(pitch);
        }
      }
      dragRef.current = { mode: 'none' };
      drawGrid();
      return;
    }

    if (d.mode === 'move' || d.mode === 'resize') {
      if (JSON.stringify(d.snapshot) !== JSON.stringify(notesRef.current)) commitHistory(d.snapshot);
    }
    dragRef.current = { mode: 'none' };
    drawGrid();
  }, [commitHistory, drawGrid, hitTestNote, onNotesChange, playPreview, rowH, snapStep, totalBeats, wPx]);

  const onGridContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTestNote(x, y, notesRef.current);
    if (!hit) return;
    const k = noteKey(notesRef.current[hit.index]!);
    commitHistory(notesRef.current);
    onNotesChange(notesRef.current.filter((_, i) => i !== hit.index));
    setSelectedKeys(prev => { const n = new Set(prev); n.delete(k); return n; });
  };

  // Velocity lane interactions
  const findNearestVelNote = (x: number) => {
    let best = -1;
    let bestD = 1e9;
    for (let i = 0; i < notesRef.current.length; i++) {
      const note = notesRef.current[i]!;
      const xc = (note.startTime / totalBeats) * wPx;
      const bw = Math.max(3, (note.duration / totalBeats) * wPx * 0.6);
      const d = Math.abs(x - xc);
      if (d < bw + 6 && d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const onVelPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const data = velCoordsFromEvent(e.clientX, e.clientY);
    if (!data) return;
    const { x, y } = data;
    const best = findNearestVelNote(x);
    if (best < 0) return;
    const hitKey = noteKey(notesRef.current[best]!);
    const activeSel = selectedKeys.has(hitKey) ? selectedKeys : new Set([hitKey]);
    if (!selectedKeys.has(hitKey)) setSelectedKeys(new Set([hitKey]));
    commitHistory(notesRef.current);
    const indices = notesRef.current.map((n, i) => (activeSel.has(noteKey(n)) ? i : -1)).filter(i => i >= 0);
    const anchorVelocity = notesRef.current[best]!.velocity;
    dragRef.current = { mode: 'vel', snapshot: notesRef.current.map(n => ({ ...n })), index: best, indices, anchorVelocity };

    const chartH = VELOCITY_H - 16;
    const rel = 1 - (y - 8) / chartH;
    const delta = clampVel(rel * 127) - anchorVelocity;
    onNotesChange(dragRef.current.snapshot.map((n, i) =>
      indices.includes(i) ? { ...n, velocity: clampVel(n.velocity + delta) } : { ...n },
    ));
  };

  const onVelPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const data = velCoordsFromEvent(e.clientX, e.clientY);
    if (!data) return;
    const { x, y } = data;
    const d = dragRef.current;
    if (d.mode === 'vel') {
      const rel = 1 - (y - 8) / (VELOCITY_H - 16);
      const delta = clampVel(rel * 127) - d.anchorVelocity;
      onNotesChange(d.snapshot.map((n, i) =>
        d.indices.includes(i) ? { ...n, velocity: clampVel(n.velocity + delta) } : { ...n },
      ));
    }
    const best = findNearestVelNote(x);
    setHoverVelIdx(best >= 0 ? best : null);
    if (best >= 0) {
      setVelTooltip({ x, y, v: notesRef.current[best]!.velocity });
    } else {
      setVelTooltip(null);
    }
  };

  const endVelDrag = () => {
    if (dragRef.current.mode === 'vel') dragRef.current = { mode: 'none' };
  };

  // Global pointer-up
  useEffect(() => {
    const up = () => {
      finishGridInteraction();
      endVelDrag();
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [finishGridInteraction]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!selectedKeys.size) return;
      e.preventDefault();
      commitHistory(notesRef.current);
      onNotesChange(notesRef.current.filter(n => !selectedKeys.has(noteKey(n))));
      setSelectedKeys(new Set());
      return;
    }

    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelectedKeys(new Set(notesRef.current.map(noteKey)));
      return;
    }

    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      redo();
      return;
    }

    // Arrow key nudge
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (!selectedKeys.size) return;
      e.preventDefault();
      commitHistory(notesRef.current);
      const dt = e.key === 'ArrowLeft' ? -snapStep : e.key === 'ArrowRight' ? snapStep : 0;
      const dp = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      const next = notesRef.current.map(n => {
        if (!selectedKeys.has(noteKey(n))) return { ...n };
        return {
          ...n,
          startTime: Math.max(0, Math.min(totalBeats - snapStep, n.startTime + dt)),
          pitch: Math.max(MIDI_MIN, Math.min(MIDI_MAX - 1, n.pitch + dp)),
        };
      });
      onNotesChange(next);
      // Re-key selected set after pitch/time shift
      setSelectedKeys(new Set(next.filter(n => {
        const orig = notesRef.current.find(o => Math.abs(o.startTime - (n.startTime - dt)) < 1e-9 && o.pitch === n.pitch - dp);
        return orig && selectedKeys.has(noteKey(orig));
      }).map(noteKey)));
    }
  };

  const chordSegments = useMemo(() => {
    if (!showChords) return [];
    const all = chordOverlayNotes?.length ? chordOverlayNotes : notes;
    if (!all.length) return [];
    const segs: Array<{ startBeat: number; endBeat: number; name: string }> = [];
    let cur: { startBeat: number; name: string } | null = null;
    for (let b = 0; b < totalBeats; b++) {
      const pcs = all.filter(n => b + 1e-6 >= n.startTime && b < n.startTime + n.duration - 1e-6).map(n => n.pitch % 12);
      const name = pcsToChordName(pcs) ?? '—';
      if (!cur) { cur = { startBeat: b, name }; continue; }
      if (name === cur.name) continue;
      segs.push({ startBeat: cur.startBeat, endBeat: b, name: cur.name });
      cur = { startBeat: b, name };
    }
    if (cur) segs.push({ startBeat: cur.startBeat, endBeat: totalBeats, name: cur.name });
    return segs.filter(s => !(s.name === '—' && s.endBeat - s.startBeat >= 4));
  }, [showChords, chordOverlayNotes, notes, totalBeats]);

  const pianoKeys = useMemo(() => {
    const rows: { midi: number; isBlack: boolean }[] = [];
    for (let m = MIDI_MAX - 1; m >= MIDI_MIN; m--) {
      rows.push({ midi: m, isBlack: BLACK_PCS.has(m % 12) });
    }
    return rows;
  }, []);

  const zoomIn = () => setPxPerBeat(v => Math.min(MAX_PX_PER_BEAT, Math.round(v * 1.25)));
  const zoomOut = () => setPxPerBeat(v => Math.max(MIN_PX_PER_BEAT, Math.round(v * 0.8)));

  const toolbarBtnBase: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10,
    height: 26,
    borderRadius: 6,
    padding: '0 8px',
    border: '1px solid',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: 'transparent',
  };
  const inactiveBtn: React.CSSProperties = {
    ...toolbarBtnBase,
    borderColor: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.45)',
  };
  const activeBtn: React.CSSProperties = {
    ...toolbarBtnBase,
    borderColor: 'rgba(255,109,63,0.5)',
    color: '#FF6D3F',
    background: 'rgba(255,109,63,0.10)',
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="outline-none rounded-xl overflow-hidden border flex flex-col focus:ring-1 focus:ring-[rgba(255,109,63,0.35)]"
      style={{ background: 'var(--piano-roll-surface, #0A0A0B)', borderColor: 'var(--border-weak, rgba(255,255,255,0.08))' }}
      onMouseDown={() => containerRef.current?.focus()}
      onKeyDown={onKeyDown}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ background: 'var(--piano-roll-bg, #0C0C0D)', minHeight: 42, borderColor: 'var(--border-weak, rgba(255,255,255,0.08))' }}
      >
        {/* Layer name */}
        <span style={{ ...inactiveBtn, border: 'none', padding: '0 4px 0 0', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {layerName}
        </span>

        {/* Tool: Draw / Select */}
        <div className="flex items-center" style={{ border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, overflow: 'hidden' }}>
          <button type="button" style={tool === 'draw' ? activeBtn : inactiveBtn} onClick={() => setTool('draw')} title="Draw (pencil)">
            ✏ Draw
          </button>
          <button type="button" style={{ ...(tool === 'select' ? activeBtn : inactiveBtn), borderLeft: '1px solid rgba(255,255,255,0.10)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} onClick={() => setTool('select')} title="Select (cursor)">
            ⬚ Select
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button type="button" style={undoCount > 0 ? inactiveBtn : { ...inactiveBtn, opacity: 0.35, cursor: 'not-allowed' }} onClick={undo} title="Undo (Ctrl+Z)">
            ↶{undoCount > 0 ? ` ${Math.min(undoCount, 99)}` : ''}
          </button>
          <button type="button" style={redoCount > 0 ? inactiveBtn : { ...inactiveBtn, opacity: 0.35, cursor: 'not-allowed' }} onClick={redo} title="Redo (Ctrl+Shift+Z)">
            ↷{redoCount > 0 ? ` ${Math.min(redoCount, 99)}` : ''}
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button type="button" style={inactiveBtn} onClick={zoomOut} title="Zoom out (Ctrl+scroll)">−</button>
          <button type="button" style={inactiveBtn} onClick={zoomIn} title="Zoom in (Ctrl+scroll)">+</button>
        </div>

        {/* Snap */}
        <div className="flex items-center gap-1 flex-wrap">
          <span style={{ ...inactiveBtn, border: 'none', padding: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Snap</span>
          {SNAP_OPTIONS.map(o => (
            <button key={o.label} type="button" style={snapStep === o.step ? activeBtn : inactiveBtn} onClick={() => setSnapStep(o.step)}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Quantize */}
        <button type="button" style={inactiveBtn} onClick={quantizeAll} title="Quantize all notes to snap">
          Quantize
        </button>

        {/* Chords toggle */}
        <button
          type="button"
          style={showChords ? activeBtn : inactiveBtn}
          onClick={toggleChordStrip}
          title="Toggle chord overlay"
        >
          Chords
        </button>

        {/* Clear */}
        <button
          type="button"
          style={{ ...toolbarBtnBase, borderColor: 'rgba(233,69,96,0.35)', color: 'rgba(233,69,96,0.8)' }}
          onClick={clearAll}
        >
          Clear
        </button>

        {/* Note count */}
        <span
          style={{
            ...inactiveBtn,
            border: 'none',
            marginLeft: 'auto',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 10,
            letterSpacing: '0.04em',
          }}
        >
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Main layout: piano + grid */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Piano keyboard */}
        <div
          className="shrink-0 border-r relative select-none overflow-hidden"
          style={{ width: PIANO_W, height: GRID_H + (showChords ? CHORD_H : 0), background: 'var(--piano-roll-bg, #0C0C0D)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {showChords && (
            <div
              className="absolute left-0 top-0 w-full border-b"
              style={{ height: CHORD_H, background: 'var(--piano-roll-bg, #0C0C0D)', borderColor: 'rgba(255,255,255,0.08)', zIndex: 2 }}
            />
          )}

          {pianoKeys.map(({ midi, isBlack }) => {
            const row = MIDI_MAX - 1 - midi;
            const top = row * rowH + (showChords ? CHORD_H : 0);
            const h = rowH;
            const isC = midi % 12 === 0;
            const hk = `k${midi}`;
            const isHov = hoverKey === hk;

            if (isBlack) {
              const bw = Math.round(PIANO_W * 0.62);
              const bh = Math.round(h * 1.5);
              return (
                <button
                  key={hk}
                  type="button"
                  className="absolute z-10 border"
                  style={{
                    left: PIANO_W - bw,
                    top: top - h * 0.25,
                    width: bw,
                    height: bh,
                    background: isHov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '0 0 3px 3px',
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
                className="absolute left-0 border-b flex items-center justify-between px-1"
                style={{
                  top,
                  width: PIANO_W,
                  height: h,
                  background: isHov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.055)',
                  borderColor: 'rgba(255,255,255,0.07)',
                  zIndex: 1,
                }}
                onMouseEnter={() => setHoverKey(hk)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => playPreview(midi)}
                aria-label={pitchLabel(midi)}
              >
                {isC && (
                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.55)', lineHeight: 1, marginLeft: 2 }}>
                    {pitchLabel(midi)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden min-w-0"
          style={{ background: 'var(--piano-roll-bg, #0C0C0D)' }}
        >
          <div style={{ width: wPx, minWidth: '100%' }}>
            {/* Chord strip */}
            {showChords && (
              <div className="relative border-b" style={{ height: CHORD_H, background: 'var(--piano-roll-bg, #0C0C0D)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {chordSegments.map(seg => {
                  const left = (seg.startBeat / totalBeats) * wPx;
                  const width = ((seg.endBeat - seg.startBeat) / totalBeats) * wPx;
                  if (width < 14) return null;
                  return (
                    <div
                      key={`${seg.startBeat}-${seg.name}`}
                      className="absolute inset-y-0 flex items-center justify-center px-1 overflow-hidden"
                      style={{ left, width }}
                    >
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          background: seg.name === '—' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: seg.name === '—' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.88)',
                          maxWidth: '100%',
                        }}
                      >
                        {seg.name === '—' ? '—' : displayChordName(seg.name)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grid canvas */}
            <canvas
              ref={gridCanvasRef}
              className="block touch-pan-x"
              style={{
                height: GRID_H,
                cursor: tool === 'draw'
                  ? 'crosshair'
                  : dragRef.current.mode === 'rubber'
                    ? 'default'
                    : 'default',
              }}
              onPointerDown={onGridPointerDown}
              onPointerMove={onGridPointerMove}
              onPointerUp={finishGridInteraction}
              onPointerCancel={finishGridInteraction}
              onContextMenu={onGridContextMenu}
            />

            {/* Velocity lane */}
            <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {/* Velocity header bar */}
              <div
                className="flex items-center justify-between px-3"
                style={{ height: 24, background: 'var(--piano-roll-bg, #0C0C0D)', borderBottom: velExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none', cursor: 'pointer' }}
                onClick={() => setVelExpanded(v => !v)}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Velocity
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  {velExpanded ? '▲' : '▼'}
                </span>
              </div>

              {velExpanded && (
                <div className="relative">
                  <canvas
                    ref={velCanvasRef}
                    className="block cursor-ns-resize"
                    style={{ height: VELOCITY_H }}
                    onPointerDown={onVelPointerDown}
                    onPointerMove={onVelPointerMove}
                    onPointerUp={endVelDrag}
                    onPointerCancel={endVelDrag}
                    onMouseLeave={() => { endVelDrag(); setHoverVelIdx(null); setVelTooltip(null); }}
                  />
                  {velTooltip && hoverVelIdx != null && (
                    <div
                      className="pointer-events-none absolute z-20 px-1.5 py-0.5 rounded border"
                      style={{
                        left: Math.min(wPx - 60, velTooltip.x + 8),
                        top: Math.max(0, velTooltip.y - 26),
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        background: 'var(--piano-roll-surface, #0A0A0B)',
                        color: 'var(--text, #fff)',
                        borderColor: 'var(--border, rgba(255,255,255,0.12))',
                      }}
                    >
                      vel {velTooltip.v}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="px-3 py-1 border-t shrink-0 flex items-center justify-between gap-4"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <p
          className="text-[9px] font-mono"
          style={{ color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, margin: 0 }}
        >
          Draw: click add · right-edge resize · drag move · RMB delete &nbsp;·&nbsp; Select: drag rubber-band &nbsp;·&nbsp; Del remove · Shift+click multi · ←→↑↓ nudge · Ctrl+A all · Ctrl+Z undo · Ctrl+scroll zoom
        </p>
        <span
          className="text-[9px] font-mono shrink-0"
          style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em' }}
        >
          Snap: {SNAP_OPTIONS.find(o => o.step === snapStep)?.label ?? '1/16'}
        </span>
      </div>
    </div>
  );
}

/** Brighten a hex color by mixing toward white */
function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r)) return hex;
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
