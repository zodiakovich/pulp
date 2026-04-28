'use client';

import React, { useMemo, useCallback } from 'react';
import type { NoteEvent } from '@/lib/music-engine';

const STEP_DUR = 0.25; // 1/16 note in beats

const ROWS = [
  { label: 'Kick',   pitch: 36, altPitch: 35,  velocity: 100 },
  { label: 'Snare',  pitch: 38, altPitch: 40,  velocity: 90  },
  { label: 'C.Hat',  pitch: 42, altPitch: 51,  velocity: 80  },
  { label: 'O.Hat',  pitch: 46, altPitch: null, velocity: 80  },
  { label: 'Perc',   pitch: 37, altPitch: null, velocity: 75  },
] as const;

const STEP_SIZE = 32;
const STEP_GAP  = 2;
const BEAT_GAP  = 6;  // extra gap between beats (groups of 4)
const BAR_GAP   = 12; // extra gap between bars
const LABEL_W   = 56;

export interface StepSequencerProps {
  notes: NoteEvent[];
  bars: number;
  onNotesChange: (notes: NoteEvent[]) => void;
  isPlaying?: boolean;
  playheadBeat?: number;
}

function notesToGrid(notes: NoteEvent[], totalSteps: number): boolean[][] {
  const grid = ROWS.map(() => new Array(totalSteps).fill(false) as boolean[]);
  for (const note of notes) {
    const step = Math.round(note.startTime / STEP_DUR);
    if (step < 0 || step >= totalSteps) continue;
    const rowIdx = ROWS.findIndex(
      r => r.pitch === note.pitch || (r.altPitch != null && r.altPitch === note.pitch),
    );
    if (rowIdx >= 0) grid[rowIdx]![step] = true;
    else grid[4]![step] = true; // catch-all → Perc
  }
  return grid;
}

function gridToNotes(grid: boolean[][]): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r]!;
    for (let s = 0; s < (grid[r]?.length ?? 0); s++) {
      if (grid[r]![s]) {
        notes.push({ pitch: row.pitch, startTime: s * STEP_DUR, duration: STEP_DUR, velocity: row.velocity });
      }
    }
  }
  return notes.sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);
}

export function StepSequencer({ notes, bars, onNotesChange, isPlaying = false, playheadBeat = 0 }: StepSequencerProps) {
  const totalSteps = bars * 16;

  const grid = useMemo(() => notesToGrid(notes, totalSteps), [notes, totalSteps]);

  const activeStep = isPlaying
    ? Math.floor(((playheadBeat % (bars * 4)) / STEP_DUR)) % totalSteps
    : -1;

  const toggleStep = useCallback((rowIdx: number, step: number) => {
    const next = grid.map(row => [...row]);
    next[rowIdx]![step] = !next[rowIdx]![step];
    onNotesChange(gridToNotes(next));
  }, [grid, onNotesChange]);

  // Build step columns: each step has a left offset accounting for beat/bar gaps
  const stepOffsets = useMemo(() => {
    const offsets: number[] = [];
    let x = 0;
    for (let s = 0; s < totalSteps; s++) {
      offsets.push(x);
      x += STEP_SIZE + STEP_GAP;
      const nextS = s + 1;
      if (nextS % 16 === 0 && nextS < totalSteps) x += BAR_GAP;
      else if (nextS % 4 === 0) x += BEAT_GAP;
    }
    return offsets;
  }, [totalSteps]);

  const gridWidth = totalSteps === 0
    ? 0
    : stepOffsets[totalSteps - 1]! + STEP_SIZE;

  return (
    <div
      style={{
        background: 'var(--piano-roll-surface, #0A0A0B)',
        border: '1px solid var(--border-weak, rgba(255,255,255,0.08))',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: 38,
          background: 'var(--piano-roll-bg, #0C0C0D)',
          borderBottom: '1px solid var(--border-weak, rgba(255,255,255,0.08))',
        }}
      >
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Drums — Step Sequencer
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>
          {bars} {bars === 1 ? 'bar' : 'bars'} · {totalSteps} steps · 1/16
        </span>
      </div>

      {/* Bar number ruler */}
      <div
        className="flex"
        style={{ background: 'var(--piano-roll-bg, #0C0C0D)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 22, overflow: 'hidden' }}
      >
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        <div style={{ overflowX: 'hidden', flex: 1 }}>
          <div style={{ position: 'relative', width: gridWidth, height: 22 }}>
            {Array.from({ length: bars }, (_, b) => (
              <span
                key={b}
                style={{
                  position: 'absolute',
                  left: stepOffsets[b * 16] ?? 0,
                  top: 4,
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.04em',
                }}
              >
                Bar {b + 1}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto" style={{ background: '#0C0C0D' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0 12px', width: LABEL_W + gridWidth }}>
          {ROWS.map((row, rowIdx) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', height: STEP_SIZE }}>
              {/* Row label */}
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  paddingLeft: 12,
                  paddingRight: 8,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.40)',
                  letterSpacing: '0.04em',
                  textAlign: 'right',
                }}
              >
                {row.label}
              </div>

              {/* Steps */}
              <div style={{ position: 'relative', width: gridWidth, height: STEP_SIZE }}>
                {Array.from({ length: totalSteps }, (_, step) => {
                  const active = grid[rowIdx]![step] ?? false;
                  const isPlayhead = activeStep === step;
                  const beatInBar = Math.floor(step % 16 / 4);
                  const isAltBeat = beatInBar % 2 === 1;
                  const left = stepOffsets[step] ?? 0;

                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => toggleStep(rowIdx, step)}
                      style={{
                        position: 'absolute',
                        left,
                        top: 0,
                        width: STEP_SIZE,
                        height: STEP_SIZE,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 80ms, box-shadow 80ms',
                        background: active
                          ? '#FF6D3F'
                          : isPlayhead
                            ? 'rgba(255,109,63,0.18)'
                            : isAltBeat
                              ? 'rgba(255,255,255,0.04)'
                              : '#1A1A2E',
                        boxShadow: active
                          ? '0 0 6px rgba(255,109,63,0.40)'
                          : isPlayhead
                            ? '0 0 0 1px rgba(255,109,63,0.50)'
                            : 'none',
                        outline: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,109,63,0.22)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(255,109,63,0.55)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          const bg = isPlayhead
                            ? 'rgba(255,109,63,0.18)'
                            : isAltBeat ? 'rgba(255,255,255,0.04)' : '#1A1A2E';
                          (e.currentTarget as HTMLButtonElement).style.background = bg;
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = isPlayhead
                            ? '0 0 0 1px rgba(255,109,63,0.50)' : 'none';
                        }
                      }}
                      title={`${row.label} step ${(step % 16) + 1} / bar ${Math.floor(step / 16) + 1}`}
                      aria-label={`${row.label} step ${step + 1} ${active ? 'on' : 'off'}`}
                      aria-pressed={active}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div
        className="px-3 py-1 border-t shrink-0 flex items-center justify-between gap-4"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
          Click to toggle · Each column = 1/16 note · Beat groups of 4 highlighted
        </p>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          {notes.length} hits
        </span>
      </div>
    </div>
  );
}
