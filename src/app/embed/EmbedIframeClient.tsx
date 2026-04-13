'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GENRES,
  generateTrack,
  getDefaultParams,
  parsePrompt,
  type GenerationParams,
  type GenerationResult,
  type NoteEvent,
} from '@/lib/music-engine';
import { generateMidiFormat0, downloadMidi } from '@/lib/midi-writer';
import { getLayerVizColorsForCanvas, LAYER_VIZ_COLORS, readCssColor } from '@/lib/design-system';
import { useColorScheme } from '@/hooks/useColorScheme';

/** Layer keys for GenerationResult (strict palette). */
const LAYERS = ['melody', 'chords', 'bass', 'drums'] as const;
type LayerKey = (typeof LAYERS)[number];

function normalizeGenreParam(raw: string | null): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (GENRES[v]) return v;
  const byName = Object.entries(GENRES).find(
    ([, g]) => g.name.toLowerCase().replace(/\s/g, '') === v.toLowerCase().replace(/\s/g, ''),
  );
  return byName?.[0] ?? null;
}

function parseKeyParam(raw: string | null): { key?: string; scale?: string } {
  const v = (raw ?? '').trim();
  if (!v) return {};
  const compact = v.replace(/\s/g, '');
  const m = compact.match(/^([A-Ga-g])(#|b)?(m|min|minor|maj|major)?$/);
  if (!m) return {};
  const note = (m[1] ?? 'A').toUpperCase() + (m[2] ?? '');
  const qual = (m[3] ?? '').toLowerCase();
  const scale =
    qual === 'm' || qual === 'min' || qual === 'minor' ? 'minor' : qual ? 'major' : undefined;
  return { key: note, scale };
}

/** Copied from home `page.tsx` — canvas piano roll preview. */
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
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
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
      const rx = x;
      const ry = y - noteH / 2;
      const rw = noteW;
      const rh = noteH;
      const r = 1.5;
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

  return <canvas ref={canvasRef} className="w-full rounded-md piano-roll" style={{ height }} />;
}

const WATERMARK_HREF = 'https://pulp-git-main-sauloafm-2127s-projects.vercel.app';

export function EmbedIframeClient({
  initialGenre,
  initialBpm,
  initialKey,
}: {
  initialGenre: string | null;
  initialBpm: string | null;
  initialKey: string | null;
}) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseParams, setBaseParams] = useState<GenerationParams>(() => getDefaultParams());
  const colorScheme = useColorScheme();
  const layerCanvasColors = useMemo(() => getLayerVizColorsForCanvas(), [colorScheme]);

  useEffect(() => {
    const g = normalizeGenreParam(initialGenre);
    const bpm = initialBpm ? Math.max(60, Math.min(200, Math.round(Number(initialBpm)))) : null;
    const { key, scale } = parseKeyParam(initialKey);
    setBaseParams(p => ({
      ...p,
      genre: g ?? p.genre,
      bpm: bpm ?? p.bpm,
      key: key ?? p.key,
      scale: scale ?? p.scale,
    }));
  }, [initialGenre, initialBpm, initialKey]);

  const handleDownloadLayer = useCallback((layer: LayerKey, notes: NoteEvent[]) => {
    if (!result) return;
    const bpm = result.params.bpm;
    const midi = generateMidiFormat0(notes, bpm, `pulp-${layer}`);
    downloadMidi(midi, `pulp-${layer}.mid`);
  }, [result]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const parsed = prompt.trim() ? parsePrompt(prompt.trim()) : {};
      const merged: GenerationParams = {
        ...getDefaultParams(),
        ...baseParams,
        ...parsed,
        layers: { melody: true, chords: true, bass: true, drums: true },
      };

      const body = {
        bpm: merged.bpm,
        genre: merged.genre,
        key: merged.key,
        bars: merged.bars,
        prompt: prompt.trim(),
      };

      let next: GenerationResult | null = null;

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.status === 429) {
          const d = (await res.json().catch(() => null)) as { retryAfter?: number } | null;
          const after = typeof d?.retryAfter === 'number' ? d.retryAfter : null;
          setError(after != null ? `Rate limited — try again in ${after}s` : 'Rate limited');
          return;
        }

        if (!res.ok) throw new Error('api');

        const data = (await res.json()) as { result: GenerationResult };
        next = data.result;
      } catch {
        next = generateTrack(merged);
      }

      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#FF6D3F' }}>
          pulp
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(138,138,154,0.5)' }}>
          AI MIDI Generator
        </span>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="dark techno, 128bpm, Am"
          style={{
            flex: 1,
            height: 40,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            padding: '0 12px',
            fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
          }}
          onKeyDown={e => e.key === 'Enter' && void handleGenerate()}
        />
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          style={{
            height: 40,
            padding: '0 16px',
            background: '#FF6D3F',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: isGenerating ? 'wait' : 'pointer',
            flexShrink: 0,
            opacity: isGenerating ? 0.85 : 1,
          }}
        >
          {isGenerating ? '...' : 'Generate'}
        </button>
      </div>

      {error ? (
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            flex: 1,
            minHeight: 0,
            alignContent: 'start',
          }}
        >
          {LAYERS.map(layer => {
            const notes = result[layer];
            if (!notes.length) return null;
            return (
              <div
                key={layer}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span
                    style={{
                      fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                      fontWeight: 700,
                      fontSize: 11,
                      color: LAYER_VIZ_COLORS[layer],
                      textTransform: 'capitalize',
                    }}
                  >
                    {layer}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadLayer(layer, notes)}
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    aria-label={`Download ${layer}`}
                  >
                    ↓
                  </button>
                </div>
                <PianoRoll notes={notes} color={layerCanvasColors[layer]} height={48} />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }} aria-hidden />
      )}

      <div style={{ textAlign: 'right', marginTop: 'auto', flexShrink: 0 }}>
        <a
          href={WATERMARK_HREF}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: 'rgba(138,138,154,0.3)',
            textDecoration: 'none',
          }}
        >
          made with pulp ✦
        </a>
      </div>
    </div>
  );
}
