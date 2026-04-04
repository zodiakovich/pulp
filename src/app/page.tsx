'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateTrack, getDefaultParams, GENRES, STYLE_TAGS, parsePrompt,
  type GenerationParams, type GenerationResult, type NoteEvent,
} from '@/lib/music-engine';
import { generateMidiFormat0, generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';
import { playNotes, playLayer, stopAllPlayback } from '@/lib/audio-engine';

// ============================================================
// TYPES
// ============================================================
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

// ============================================================
// PIANO ROLL COMPONENT
// ============================================================
function PianoRoll({ notes, color, height = 80 }: { notes: NoteEvent[]; color: string; height?: number }) {
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
      const noteH = Math.max(2, h / pitchRange * 0.8);

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
    <canvas
      ref={canvasRef}
      className="w-full rounded-md piano-roll"
      style={{ height }}
    />
  );
}

// ============================================================
// LAYER CARD
// ============================================================
const LAYER_COLORS: Record<string, string> = {
  melody: '#FF6D3F',
  chords: '#00B894',
  bass: '#4A9EFF',
  drums: '#B366FF',
};

function LayerCard({
  name, notes, bpm, genre, onDownload,
}: {
  name: string; notes: NoteEvent[]; bpm: number; genre: string;
  onDownload: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const color = LAYER_COLORS[name] || '#FF6D3F';

  const handlePlay = () => {
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
    } else {
      setPlaying(true);
      playLayer(name as 'melody' | 'chords' | 'bass' | 'drums', notes, bpm, genre, () => setPlaying(false));
    }
  };

  return (
    <div className="border border-white/8 rounded-lg bg-white/[0.02] p-3 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-display text-sm font-bold capitalize">{name}</span>
          <span className="text-xs text-muted font-mono">{notes.length} notes</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePlay}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            title={playing ? 'Stop' : 'Play'}
          >
            {playing ? '■' : '▶'}
          </button>
          <button
            onClick={onDownload}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-xs"
            title="Download .mid"
          >
            ↓
          </button>
        </div>
      </div>
      <PianoRoll notes={notes} color={color} />
    </div>
  );
}

// ============================================================
// HISTORY SIDEBAR
// ============================================================
function HistorySidebar({
  history,
  onRestore,
  onClose,
}: {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-bg-surface border-l border-white/8 z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
        <span className="font-display font-bold text-sm">
          History {history.length > 0 && <span className="text-muted font-normal">({history.length})</span>}
        </span>
        <button onClick={onClose} className="text-muted hover:text-white transition-colors text-lg leading-none">×</button>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-sm text-center px-6">Generate something to see your history here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {history.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onRestore(entry)}
              className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <p className="text-sm text-white/90 truncate mb-1">
                {entry.prompt || GENRES[entry.genre]?.name || entry.genre}
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-mono text-papaya">{GENRES[entry.genre]?.name || entry.genre}</span>
                <span className="text-xs font-mono text-muted">{entry.key} {entry.scale}</span>
                <span className="text-xs font-mono text-muted">{entry.bpm} BPM</span>
              </div>
              <p className="text-xs text-muted/50 mt-1">
                {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-white/8">
        <p className="text-xs text-muted/50 text-center">Session only · clears on refresh</p>
      </div>
    </div>
  );
}

// ============================================================
// CONSTANTS
// ============================================================
const GENRE_LIST = Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name }));
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['minor', 'major', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'pentatonic_minor', 'pentatonic_major', 'blues'];

// ============================================================
// MAIN PAGE
// ============================================================
export default function Home() {
  const [params, setParams] = useState<GenerationParams>(getDefaultParams());
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeStyleTag, setActiveStyleTag] = useState<string | null>(null);
  const toolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGenerate = useCallback((overrideParams?: Partial<GenerationParams>, overridePrompt?: string) => {
    setIsGenerating(true);
    const parsed = (overridePrompt ?? prompt) ? parsePrompt(overridePrompt ?? prompt) : {};
    const finalParams: GenerationParams = {
      ...params,
      ...parsed,
      ...overrideParams,
    };
    setParams(finalParams);

    setTimeout(() => {
      const gen = generateTrack(finalParams);
      setResult(gen);
      setIsGenerating(false);

      const entry: HistoryEntry = {
        id: Date.now().toString(),
        prompt: overridePrompt ?? prompt,
        genre: finalParams.genre,
        key: finalParams.key,
        scale: finalParams.scale,
        bpm: finalParams.bpm,
        bars: finalParams.bars,
        result: gen,
        params: finalParams,
        timestamp: new Date(),
      };
      setHistory(prev => [entry, ...prev].slice(0, 20));
    }, 300);
  }, [params, prompt]);

  const handleStyleTag = (tag: string) => {
    const preset = STYLE_TAGS[tag];
    if (!preset) return;
    setActiveStyleTag(tag);
    setPrompt(tag.toLowerCase());
    const newParams = { ...params, ...preset };
    setParams(newParams);
    handleGenerate(preset, tag.toLowerCase());
    toolRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleLayer = (layer: keyof GenerationParams['layers']) => {
    setParams(p => ({ ...p, layers: { ...p.layers, [layer]: !p.layers[layer] } }));
  };

  const handlePlayAll = () => {
    if (!result) return;
    if (playingAll) { stopAllPlayback(); setPlayingAll(false); return; }
    setPlayingAll(true);
    playNotes({
      melody: params.layers.melody ? result.melody : undefined,
      chords: params.layers.chords ? result.chords : undefined,
      bass: params.layers.bass ? result.bass : undefined,
      drums: params.layers.drums ? result.drums : undefined,
      bpm: params.bpm,
      genre: params.genre,
      onComplete: () => setPlayingAll(false),
    });
  };

  const handleDownloadLayer = (name: string, notes: NoteEvent[]) => {
    const genre = GENRES[params.genre]?.name || 'track';
    const midi = generateMidiFormat0(notes, params.bpm, `pulp-${name}`);
    downloadMidi(midi, `pulp-${name}-${genre.toLowerCase().replace(/\s/g, '-')}-${params.key}${params.scale}.mid`);
  };

  const handleDownloadAll = () => {
    if (!result) return;
    const tracks = [];
    if (result.melody.length > 0) tracks.push({ name: 'Melody', notes: result.melody, channel: 0 });
    if (result.chords.length > 0) tracks.push({ name: 'Chords', notes: result.chords, channel: 1 });
    if (result.bass.length > 0) tracks.push({ name: 'Bass', notes: result.bass, channel: 2 });
    if (result.drums.length > 0) tracks.push({ name: 'Drums', notes: result.drums, channel: 9 });
    const midi = generateMidiFormat1(tracks, params.bpm);
    const genre = GENRES[params.genre]?.name || 'track';
    downloadMidi(midi, `pulp-${genre.toLowerCase().replace(/\s/g, '-')}-${params.key}${params.scale}.mid`);
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setParams(entry.params);
    setResult(entry.result);
    setPrompt(entry.prompt);
    setShowHistory(false);
    toolRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTool = () => toolRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen">

      {/* HISTORY SIDEBAR */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <HistorySidebar
            history={history}
            onRestore={handleRestoreHistory}
            onClose={() => setShowHistory(false)}
          />
        </>
      )}

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/5' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display font-extrabold text-xl text-gradient">pulp</span>
          <div className="flex items-center gap-6 text-sm text-muted">
            <button onClick={scrollToTool} className="hover:text-white transition-colors">Create</button>
            <button
              onClick={() => setShowHistory(true)}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              History
              {history.length > 0 && (
                <span className="text-xs bg-papaya/20 text-papaya px-1.5 py-0.5 rounded-full font-mono">
                  {history.length}
                </span>
              )}
            </button>
          </div>
          <button className="text-sm px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
            Sign in
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-16 px-6 max-w-6xl mx-auto">
        <h1 className="font-display font-extrabold text-6xl md:text-8xl leading-none tracking-tight animate-in">
          <span className="text-chrome">GENERATE</span><br />
          <span className="text-gradient">MIDI</span>
        </h1>
        <p className="mt-6 text-lg text-muted max-w-lg animate-in delay-200">
          Describe the track. AI generates the MIDI. Precision tools for modern producers.
        </p>
        <button
          onClick={scrollToTool}
          className="mt-8 px-8 py-3 bg-papaya text-white font-semibold rounded-lg hover:brightness-110 transition-all animate-in delay-300"
        >
          Generate MIDI — free
        </button>
      </section>

      {/* TOOL SECTION */}
      <section ref={toolRef} className="px-6 max-w-3xl mx-auto pb-20">

        {/* Prompt Input */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-papaya text-lg">✦</span>
          <input
            type="text"
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setActiveStyleTag(null); }}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="dark melodic techno, 128bpm, Am"
            className="w-full h-14 bg-bg-surface border border-bg-elevated rounded-lg pl-12 pr-32 text-base
              placeholder:text-muted/50 focus:outline-none focus:border-papaya/50 focus-glow transition-all"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-papaya text-white text-sm font-semibold
              rounded-md hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isGenerating ? '...' : 'Generate'}
          </button>
        </div>

        {/* Style Tags */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {Object.keys(STYLE_TAGS).map(tag => (
            <button
              key={tag}
              onClick={() => handleStyleTag(tag)}
              className={`style-pill ${activeStyleTag === tag ? 'active' : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Layer Toggles */}
        <div className="flex gap-2 mb-4">
          {(['melody', 'chords', 'bass', 'drums'] as const).map(layer => (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              className={`layer-toggle ${params.layers[layer] ? 'on' : 'off'}`}
              style={{ color: params.layers[layer] ? LAYER_COLORS[layer] : undefined }}
            >
              {layer.charAt(0).toUpperCase() + layer.slice(1)}
            </button>
          ))}
        </div>

        {/* Manual Controls */}
        <div className="mb-6 border border-white/8 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowManual(!showManual)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-muted hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>⚙</span> Manual Controls
            </span>
            <span className={`transform transition-transform ${showManual ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showManual && (
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Genre</label>
                <select
                  value={params.genre}
                  onChange={e => setParams(p => ({ ...p, genre: e.target.value }))}
                  className="w-full bg-bg-surface border border-bg-elevated rounded-md px-2 py-1.5 text-sm"
                >
                  {GENRE_LIST.map(g => (
                    <option key={g.key} value={g.key}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Key</label>
                <select
                  value={params.key}
                  onChange={e => setParams(p => ({ ...p, key: e.target.value }))}
                  className="w-full bg-bg-surface border border-bg-elevated rounded-md px-2 py-1.5 text-sm"
                >
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Scale</label>
                <select
                  value={params.scale}
                  onChange={e => setParams(p => ({ ...p, scale: e.target.value }))}
                  className="w-full bg-bg-surface border border-bg-elevated rounded-md px-2 py-1.5 text-sm"
                >
                  {SCALES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">
                  BPM <span className="font-mono text-papaya">{params.bpm}</span>
                </label>
                <input
                  type="range"
                  min={60} max={200} value={params.bpm}
                  onChange={e => setParams(p => ({ ...p, bpm: parseInt(e.target.value) }))}
                  className="w-full accent-papaya"
                />
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Bars</label>
                <select
                  value={params.bars}
                  onChange={e => setParams(p => ({ ...p, bars: parseInt(e.target.value) }))}
                  className="w-full bg-bg-surface border border-bg-elevated rounded-md px-2 py-1.5 text-sm"
                >
                  {[2, 4, 8].map(b => <option key={b} value={b}>{b} bars</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Global Controls */}
        {result && (
          <div className="flex gap-3 mb-4 animate-in flex-wrap">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              {playingAll ? '■ Stop' : '▶ Play All'}
            </button>
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-2 px-4 py-2 bg-tropical text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
            >
              ↓ Download All
            </button>
            <button
              onClick={() => handleGenerate()}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              ↻ Regenerate
            </button>
          </div>
        )}

        {/* Result Cards */}
        {result && (
          <div className="grid grid-cols-2 gap-3 animate-in delay-100">
            {params.layers.melody && result.melody.length > 0 && (
              <LayerCard
                name="melody" notes={result.melody} bpm={params.bpm} genre={params.genre}
                onDownload={() => handleDownloadLayer('melody', result.melody)}
              />
            )}
            {params.layers.chords && result.chords.length > 0 && (
              <LayerCard
                name="chords" notes={result.chords} bpm={params.bpm} genre={params.genre}
                onDownload={() => handleDownloadLayer('chords', result.chords)}
              />
            )}
            {params.layers.bass && result.bass.length > 0 && (
              <LayerCard
                name="bass" notes={result.bass} bpm={params.bpm} genre={params.genre}
                onDownload={() => handleDownloadLayer('bass', result.bass)}
              />
            )}
            {params.layers.drums && result.drums.length > 0 && (
              <LayerCard
                name="drums" notes={result.drums} bpm={params.bpm} genre={params.genre}
                onDownload={() => handleDownloadLayer('drums', result.drums)}
              />
            )}
          </div>
        )}

        {/* Generation info */}
        {result && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono text-muted animate-in delay-200">
            <span className="px-2 py-1 bg-white/5 rounded">{GENRES[params.genre]?.name}</span>
            <span className="px-2 py-1 bg-white/5 rounded">{params.key} {params.scale}</span>
            <span className="px-2 py-1 bg-white/5 rounded">{params.bpm} BPM</span>
            <span className="px-2 py-1 bg-white/5 rounded">{params.bars} bars</span>
          </div>
        )}
      </section>

      {/* WORKFLOW */}
      <section className="py-20 px-6 bg-bg-surface">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-extrabold text-3xl text-chrome mb-12">WORKFLOW</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { n: '01', label: 'Drop a prompt' },
              { n: '02', label: 'AI generates the MIDI' },
              { n: '03', label: 'Drop it in your DAW' },
            ].map(step => (
              <div key={step.n} className="text-center">
                <span className="font-display font-extrabold text-5xl text-chrome">{step.n}</span>
                <p className="mt-2 text-sm text-muted">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GENRES */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-extrabold text-3xl text-chrome mb-8">EVERY STYLE</h2>
          <div className="flex flex-wrap gap-3">
            {GENRE_LIST.map(g => (
              <span
                key={g.key}
                className="px-4 py-2 border border-white/8 rounded-lg text-sm text-muted hover:border-papaya/30 hover:text-white transition-all cursor-pointer"
                onClick={() => {
                  setParams(p => ({ ...p, genre: g.key }));
                  setActiveStyleTag(null);
                  scrollToTool();
                }}
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 px-6 bg-bg-surface">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="border border-white/8 rounded-xl p-8">
            <h3 className="font-display font-bold text-lg mb-1">Free</h3>
            <p className="text-3xl font-display font-bold mb-6">Free</p>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-center gap-2"><span className="text-tropical">✓</span> 5 generations per day</li>
              <li className="flex items-center gap-2"><span className="text-tropical">✓</span> Basic genres</li>
              <li className="flex items-center gap-2"><span className="text-tropical">✓</span> MIDI download</li>
            </ul>
            <button onClick={scrollToTool} className="mt-8 w-full py-3 border border-white/10 rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors">
              Generate MIDI
            </button>
          </div>
          <div className="border border-papaya/30 rounded-xl p-8 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-papaya text-white text-xs font-semibold rounded-full">
              Most Popular
            </span>
            <h3 className="font-display font-bold text-lg mb-1">Pro</h3>
            <p className="text-3xl font-display font-bold mb-6">$7<span className="text-base text-muted font-normal">/month</span></p>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-center gap-2"><span className="text-papaya">✓</span> Unlimited generations</li>
              <li className="flex items-center gap-2"><span className="text-papaya">✓</span> All 20 genres</li>
              <li className="flex items-center gap-2"><span className="text-papaya">✓</span> WAV + MIDI export</li>
              <li className="flex items-center gap-2"><span className="text-papaya">✓</span> Priority processing</li>
            </ul>
            <button className="mt-8 w-full py-3 bg-papaya text-white rounded-lg text-sm font-semibold hover:brightness-110 transition-all">
              Unlock Pro Tools
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 px-6 text-center">
        <span className="font-display font-extrabold text-2xl text-gradient">pulp</span>
        <p className="mt-3 text-sm text-muted">
          a <span className="font-display font-bold text-gradient">papaya</span><span className="text-tropical mx-0.5">●</span> tool
        </p>
        <p className="mt-2 text-xs text-muted/60">Made for producers who hear it before they play it.</p>
        <p className="mt-4 text-xs text-muted/40">© 2026 PULP. MADE BY PAPAYA.</p>
      </footer>
    </div>
  );
}
