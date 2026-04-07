'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import {
  generateTrack, getDefaultParams, GENRES, STYLE_TAGS, parsePrompt,
  type GenerationParams, type GenerationResult, type NoteEvent,
} from '@/lib/music-engine';
import { generateMidiFormat0, generateMidiFormat1, downloadMidi } from '@/lib/midi-writer';
import { playNotes, playLayer, stopAllPlayback } from '@/lib/audio-engine';
import { supabase } from '@/lib/supabase';

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
};

const LAYERS = ['melody', 'chords', 'bass', 'drums'] as const;

// ─── LAYER CARD ───────────────────────────────────────────────
function LayerCard({
  name, notes, bpm, genre, enabled, onDownload,
}: {
  name: string; notes: NoteEvent[]; bpm: number; genre: string;
  enabled: boolean; onDownload: () => void;
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
  history, onRestore, onClose,
}: {
  history: HistoryEntry[];
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
          Session History
          {history.length > 0 && (
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

      {history.length === 0 ? (
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
              <p className="text-sm truncate mb-2" style={{ color: 'rgba(240,240,255,0.85)' }}>
                {entry.prompt || GENRES[entry.genre]?.name || entry.genre}
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#FF6D3F' }}>
                  {GENRES[entry.genre]?.name || entry.genre}
                </span>
                <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>
                  {entry.key} {entry.scale}
                </span>
                <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>
                  {entry.bpm} BPM
                </span>
              </div>
              <p className="text-xs mt-2"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(138,138,154,0.4)' }}>
                {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
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

const VALID_SCALES = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian',
  'pentatonic_minor', 'pentatonic_major', 'blues'];

// ─── CONSTANTS ────────────────────────────────────────────────
const GENRE_LIST = Object.entries(GENRES).map(([key, g]) => ({ key, name: g.name }));
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['minor', 'major', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'pentatonic_minor', 'pentatonic_major', 'blues'];

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
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [credits, setCredits] = useState<{ used: number; isPro: boolean } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const toolRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
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

      setHistory(prev => {
        const dbIds = new Set(entries.map(e => e.id));
        const sessionOnly = prev.filter(e => !dbIds.has(e.id));
        return [...sessionOnly, ...entries].slice(0, 20);
      });
    } catch {
      // Ignore
    }
  }, []);

  // Load credits + history when signed in
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    loadUserCredits(userId);
    loadHistoryFromDb(userId);
  }, [isSignedIn, userId, loadUserCredits, loadHistoryFromDb]);

  // ── GENERATE ─────────────────────────────────────────────────

  const handleGenerate = useCallback(async (overrideParams?: Partial<GenerationParams>, overridePrompt?: string) => {
    // Check credits before generating (signed-in users only)
    if (isSignedIn && userId) {
      const allowed = await checkCreditsAllowed(userId);
      if (!allowed) {
        setShowUpgradeModal(true);
        return;
      }
    }

    setIsGenerating(true);

    // Try Claude AI prompt parsing, fall back silently
    let aiParsed: Partial<GenerationParams> = {};
    const promptText = overridePrompt ?? prompt;
    if (promptText && isSignedIn) {
      try {
        const res = await fetch('/api/parse-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText }),
        });
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
      const gen = generateTrack(finalParams);
      setResult(gen);
      setIsGenerating(false);

      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        prompt: promptText,
        genre: finalParams.genre,
        key: finalParams.key,
        scale: finalParams.scale,
        bpm: finalParams.bpm,
        bars: finalParams.bars,
        result: gen,
        params: finalParams,
        timestamp: new Date(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 20));

      // Persist to Supabase + update credits
      if (isSignedIn && userId) {
        try {
          await supabase.from('generations').insert({
            user_id: userId,
            prompt: promptText,
            genre: finalParams.genre,
            bpm: finalParams.bpm,
            style_tag: activeStyleTag,
            layers: gen,
          });
          await incrementCredits(userId);
          await loadUserCredits(userId);
        } catch {
          // Ignore save errors
        }
      }
    }, 320);
  }, [params, prompt, isSignedIn, userId, activeStyleTag, checkCreditsAllowed, incrementCredits, loadUserCredits]);

  const handleStyleTag = (tag: string) => {
    const preset = STYLE_TAGS[tag];
    if (!preset) return;
    setActiveStyleTag(tag);
    setPrompt(tag.toLowerCase());
    setParams(p => ({ ...p, ...preset }));
    if (!isSignedIn) return;
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
    if (!result) return;
    if (playingAll) { stopAllPlayback(); setPlayingAll(false); return; }
    setPlayingAll(true);
    playNotes({
      melody: params.layers.melody ? result.melody : undefined,
      chords: params.layers.chords ? result.chords : undefined,
      bass:   params.layers.bass   ? result.bass   : undefined,
      drums:  params.layers.drums  ? result.drums  : undefined,
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
    const tracks: { name: string; notes: NoteEvent[]; channel: number }[] = [];
    if (result.melody.length > 0) tracks.push({ name: 'Melody', notes: result.melody, channel: 0 });
    if (result.chords.length > 0) tracks.push({ name: 'Chords', notes: result.chords, channel: 1 });
    if (result.bass.length   > 0) tracks.push({ name: 'Bass',   notes: result.bass,   channel: 2 });
    if (result.drums.length  > 0) tracks.push({ name: 'Drums',  notes: result.drums,  channel: 9 });
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

  const handleCmdFocusPrompt = () => {
    scrollToTool();
    setTimeout(() => promptRef.current?.focus(), 150);
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen">

      {/* ── COMMAND BAR ── */}
      <CommandBar
        isOpen={showCommandBar}
        onClose={() => setShowCommandBar(false)}
        onGenerate={() => { if (isSignedIn) { void handleGenerate(); } else setShowCommandBar(false); }}
        onFocusPrompt={handleCmdFocusPrompt}
        onToggleLayers={handleToggleAllLayers}
        onDownloadAll={handleDownloadAll}
        hasResult={!!result}
      />

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
              onRestore={handleRestoreHistory}
              onClose={() => setShowHistory(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass' : 'bg-transparent'}`}
        style={scrolled ? { borderBottom: '1px solid #1A1A2E' } : {}}
      >
        <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
          <span className="text-gradient font-extrabold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>
            pulp
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: '#8A8A9A' }}>
            <button onClick={scrollToTool} className="transition-colors hover:text-white">Create</button>
            <button
              onClick={() => setShowHistory(true)}
              className="transition-colors hover:text-white flex items-center gap-2"
            >
              History
              {history.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,109,63,0.15)', color: '#FF6D3F', fontFamily: 'JetBrains Mono, monospace' }}>
                  {history.length}
                </span>
              )}
            </button>
            <a href="/pricing" className="transition-colors hover:text-white" style={{ textDecoration: 'none', color: '#8A8A9A' }}>
              Pricing
            </a>
            <button
              onClick={() => setShowCommandBar(true)}
              className="transition-colors hover:text-white flex items-center gap-1.5"
              title="Open command bar (⌘K)"
            >
              <kbd style={{ fontSize: 10 }}>⌘K</kbd>
            </button>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(138,138,154,0.4)' }}>v1.0</span>
          </div>

          {isLoaded && (
            isSignedIn
              ? <UserButton />
              : (
                <SignInButton mode="modal">
                  <button
                    className="text-sm h-9 px-4 rounded-lg transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#F0F0FF' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Sign in
                  </button>
                </SignInButton>
              )
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-noise pt-32 pb-24 px-8">
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
                onKeyDown={e => e.key === 'Enter' && isSignedIn && void handleGenerate()}
                placeholder="dark melodic techno, 128bpm, Am"
                className="input-field"
                style={{ paddingLeft: 40, paddingRight: 136 }}
              />
              {isSignedIn ? (
                <SpotlightButton
                  className={`btn-primary absolute right-2 top-1/2 -translate-y-1/2${isGenerating ? ' pulsing' : ''}`}
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

            {/* Credits indicator */}
            {isSignedIn && credits !== null && !credits.isPro && (
              <p className="text-xs mb-3 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>
                <span style={{ color: credits.used >= 10 ? '#E94560' : '#8A8A9A' }}>
                  {Math.max(0, 10 - credits.used)} / 10
                </span>
                {' '}generations remaining ·{' '}
                <a href="/pricing" style={{ color: '#FF6D3F', textDecoration: 'none' }}>Upgrade to Pro</a>
              </p>
            )}

            {/* Style tags */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
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
                    <div className="px-5 pb-5 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                      style={{ borderTop: '1px solid #1A1A2E' }}>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Genre</label>
                        <select value={params.genre} onChange={e => setParams(p => ({ ...p, genre: e.target.value }))}>
                          {GENRE_LIST.map(g => <option key={g.key} value={g.key}>{g.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Key</label>
                        <select value={params.key} onChange={e => setParams(p => ({ ...p, key: e.target.value }))}>
                          {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Scale</label>
                        <select value={params.scale} onChange={e => setParams(p => ({ ...p, scale: e.target.value }))}>
                          {SCALES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs uppercase tracking-wider"
                            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>BPM</label>
                          <span className="text-xs font-semibold"
                            style={{ color: '#FF6D3F', fontFamily: 'JetBrains Mono, monospace' }}>{params.bpm}</span>
                        </div>
                        <input type="range" min={60} max={200} value={params.bpm}
                          onChange={e => setParams(p => ({ ...p, bpm: parseInt(e.target.value) }))}
                          className="w-full mt-1" />
                      </div>
                      <div>
                        <label className="block mb-2 text-xs uppercase tracking-wider"
                          style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}>Bars</label>
                        <select value={params.bars} onChange={e => setParams(p => ({ ...p, bars: parseInt(e.target.value) }))}>
                          {[2, 4, 8].map(b => <option key={b} value={b}>{b} bars</option>)}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                  <SpotlightButton onClick={handleDownloadAll} className="btn-download btn-sm">
                    ↓  Download All
                  </SpotlightButton>
                  <SpotlightButton onClick={() => void handleGenerate()} className="btn-secondary btn-sm">
                    ↻  Regenerate
                  </SpotlightButton>
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* Layer result cards */}
            <AnimatePresence>
              {result && !isGenerating && (
                <motion.div
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
                        bpm={params.bpm}
                        genre={params.genre}
                        enabled={params.layers[layer]}
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
                  {[GENRES[params.genre]?.name, `${params.key} ${params.scale}`, `${params.bpm} BPM`, `${params.bars} bars`]
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
      <section className="py-24 px-8" style={{ background: '#111118', borderTop: '1px solid #1A1A2E', borderBottom: '1px solid #1A1A2E' }}>
        <div className="max-w-[1280px] mx-auto">
          <motion.h2
            className="font-extrabold mb-16"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            3 steps.<br />0 fuss.
          </motion.h2>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={revealContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {HOW_IT_WORKS.map(step => (
              <motion.div key={step.num} variants={reveal}>
                <div className="text-gradient font-extrabold mb-5"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {step.num}
                </div>
                <h3 className="font-bold mb-3"
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, letterSpacing: '-0.005em', lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: '#8A8A9A', lineHeight: 1.7 }}>{step.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── GENRE GRID ── */}
      <section className="py-24 px-8">
        <div className="max-w-[1280px] mx-auto">
          <motion.h2
            className="font-extrabold mb-3"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            20 genres, built in.
          </motion.h2>
          <motion.p
            className="mb-12 text-sm"
            style={{ color: '#8A8A9A', fontFamily: 'JetBrains Mono, monospace' }}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            Click any genre to load it into the generator.
          </motion.p>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            variants={revealContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {GENRE_LIST.map(g => (
              <motion.button
                key={g.key}
                variants={reveal}
                onClick={() => { setParams(p => ({ ...p, genre: g.key })); setActiveStyleTag(null); scrollToTool(); }}
                className="genre-card text-left"
              >
                <span className="block font-bold text-sm leading-tight"
                  style={{ fontFamily: 'Syne, sans-serif', color: 'rgba(240,240,255,0.75)' }}>
                  {g.name}
                </span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── LAYER SYSTEM ── */}
      <section className="py-24 px-8" style={{ background: '#111118', borderTop: '1px solid #1A1A2E', borderBottom: '1px solid #1A1A2E' }}>
        <div className="max-w-[1280px] mx-auto">
          <motion.h2
            className="font-extrabold mb-3"
            style={{ fontFamily: 'Syne, sans-serif', fontSize: 48, letterSpacing: '-0.015em', lineHeight: 1.15 }}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            4 independent tracks.
          </motion.h2>
          <motion.p
            className="mb-12"
            style={{ fontSize: 15, color: '#8A8A9A', maxWidth: 560, lineHeight: 1.7 }}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            Each track has its own voice, rhythm, and range. Toggle any layer on or off. Download each one separately or all at once.
          </motion.p>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={revealContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {LAYER_EXPLAINER.map(layer => (
              <motion.div key={layer.key} variants={reveal} className={`layer-card active-${layer.key}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: layer.color }} />
                  <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{layer.name}</span>
                  <span className="ml-auto text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8A8A9A' }}>{layer.range}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#8A8A9A', lineHeight: 1.7 }}>{layer.body}</p>
              </motion.div>
            ))}
          </motion.div>
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
