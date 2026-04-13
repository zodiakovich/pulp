'use client';

import { useEffect, useRef } from 'react';
import type { GenerationResult, NoteEvent } from '@/lib/music-engine';

const BG = '#0A0A0F';
const BORDER = '#1A1A2E';

const COLORS: Record<keyof GenerationResult, string> = {
  melody: '#FF6D3F',
  chords: '#A78BFA',
  bass: '#00B894',
  drums: '#E94560',
  params: '#8A8A9A' as any,
};

function allNotes(layers: GenerationResult): Array<{ layer: 'melody' | 'chords' | 'bass' | 'drums'; n: NoteEvent }> {
  return (['melody', 'chords', 'bass', 'drums'] as const).flatMap(layer =>
    (layers[layer] ?? []).map(n => ({ layer, n })),
  );
}

export function PianoRollViz({
  layers,
  bars = 4,
}: {
  layers: GenerationResult;
  bars?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const wCss = canvas.clientWidth || 800;
    const hCss = canvas.clientHeight || 220;
    canvas.width = Math.floor(wCss * dpr);
    canvas.height = Math.floor(hCss * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, wCss, hCss);

    // Simple grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let b = 0; b <= bars * 4; b++) {
      const x = (b / (bars * 4)) * wCss;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, hCss);
      ctx.stroke();
    }

    const notes = allNotes(layers);
    if (notes.length === 0) return;

    const pitches = notes.map(x => x.n.pitch);
    const minP = Math.max(24, Math.min(...pitches));
    const maxP = Math.min(108, Math.max(...pitches));
    const range = Math.max(1, maxP - minP + 1);

    for (const { layer, n } of notes) {
      const x0 = (n.startTime / (bars * 4)) * wCss;
      const x1 = ((n.startTime + n.duration) / (bars * 4)) * wCss;
      const y = (1 - (n.pitch - minP) / range) * (hCss - 16) + 8;
      const h = 6;
      const w = Math.max(2, x1 - x0);
      const alpha = 0.25 + (n.velocity / 127) * 0.75;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[layer];
      ctx.fillRect(x0, y - h / 2, w, h);
      ctx.globalAlpha = 1;
    }
  }, [layers, bars]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111118', border: `1px solid ${BORDER}` }}>
      <canvas ref={ref} style={{ width: '100%', height: 220, display: 'block' }} />
    </div>
  );
}

