'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Download, FileAudio, Loader2, Music2, SlidersHorizontal, Sparkles, Upload, X } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { SignInButtonDeferred } from '@/components/ClerkAuthDeferred';
import { PianoRollEditor } from '@/components/PianoRollEditor';
import { downloadMidi, generateMidiFormat0 } from '@/lib/midi-writer';
import type { NoteEvent } from '@/lib/music-engine';
import { stopAllAppAudio } from '@/lib/audio-control';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SCALES = ['minor', 'major', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonic_minor', 'melodic_minor', 'pentatonic_minor', 'pentatonic_major', 'blues'] as const;
const TRACK_TYPES = ['melody', 'arp', 'bass', 'counter-melody', 'pad', 'drums', 'chords', 'lead', 'pluck'] as const;
const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

type ReferenceMidiNote = {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
};

type ReferenceMidiSummary = {
  fileName: string;
  notes: ReferenceMidiNote[];
  estimatedBpm: number;
  estimatedKey: (typeof KEYS)[number];
  noteCount: number;
};

type MidiSingleResponse = {
  id: string | null;
  prompt: string;
  params: {
    key: string;
    scale: string;
    bpm: number;
    bars: number;
    trackType: string;
  };
  notes: NoteEvent[];
};

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '12px 12px',
    outline: 'none',
    fontFamily: 'DM Sans, system-ui, sans-serif',
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    marginBottom: 8,
    color: 'var(--muted)',
    fontSize: 12,
    fontFamily: 'JetBrains Mono, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };
}

function trackTypeToLayer(t: string): 'melody' | 'chords' | 'bass' | 'drums' {
  if (t === 'bass') return 'bass';
  if (t === 'drums') return 'drums';
  if (t === 'chords' || t === 'pad') return 'chords';
  return 'melody';
}

function makeMidi(notes: NoteEvent[], bpm: number, trackType: string) {
  return generateMidiFormat0(notes, bpm, `pulp-${trackType}`);
}

function midiFileName(trackType: string, bpm: number) {
  return `pulp-${trackType}-${bpm}bpm.mid`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function estimateKey(notes: ReferenceMidiNote[]): (typeof KEYS)[number] {
  const counts = new Array(12).fill(0) as number[];
  for (const note of notes) {
    counts[((note.pitch % 12) + 12) % 12] += 1;
  }
  let best = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[best]) best = i;
  }
  return PITCH_CLASS_NAMES[best];
}

function detectedLabel(referenceMidi: ReferenceMidiSummary) {
  return `Detected: ~${referenceMidi.estimatedBpm} BPM · ${referenceMidi.estimatedKey} minor · ${referenceMidi.noteCount} notes`;
}

export function MidiGeneratorClient() {
  const [prompt, setPrompt] = useState('warm afro house counter-melody with short syncopated notes');
  const [key, setKey] = useState<(typeof KEYS)[number]>('C');
  const [scale, setScale] = useState<(typeof SCALES)[number]>('minor');
  const [bpm, setBpm] = useState(124);
  const [bars, setBars] = useState(4);
  const [trackType, setTrackType] = useState<(typeof TRACK_TYPES)[number]>('melody');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [referenceMidi, setReferenceMidi] = useState<ReferenceMidiSummary | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canExport = notes.length > 0;

  async function generate() {
    stopAllAppAudio();
    setLoading(true);
    setError(null);
    try {
      const referencePayload = referenceMidi ? {
        notes: referenceMidi.notes,
        estimatedBpm: referenceMidi.estimatedBpm,
        estimatedKey: referenceMidi.estimatedKey,
        noteCount: referenceMidi.noteCount,
      } : undefined;
      const res = await fetch('/api/generate-midi-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, key, scale, bpm, bars, trackType, referenceMidi: referencePayload }),
      });
      const data = await res.json() as MidiSingleResponse | { error?: string };
      if (!res.ok) {
        throw new Error('error' in data && data.error ? data.error : 'Generation failed');
      }
      const generation = data as MidiSingleResponse;
      setNotes(generation.notes);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleReferenceFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.mid') && !lower.endsWith('.midi')) {
      setError('Upload a .mid or .midi file.');
      return;
    }

    setReferenceLoading(true);
    setError(null);
    try {
      const { Midi } = await import('@tonejs/midi');
      const buffer = await file.arrayBuffer();
      const midi = new Midi(buffer);
      const tempo = midi.header.tempos[0]?.bpm;
      const estimatedBpm = clampInt(Number.isFinite(tempo) ? tempo : bpm, 60, 220);
      const secondsToBeats = estimatedBpm / 60;
      const parsedNotes = midi.tracks
        .flatMap(track => track.notes)
        .map((note) => ({
          pitch: clampInt(note.midi, 0, 127),
          startTime: Number((note.time * secondsToBeats).toFixed(3)),
          duration: Number(Math.max(0.125, note.duration * secondsToBeats).toFixed(3)),
          velocity: clampInt(note.velocity * 127, 1, 127),
        }))
        .filter(note => note.duration > 0)
        .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);

      if (parsedNotes.length === 0) {
        throw new Error('No notes found in this MIDI file.');
      }

      const estimatedKey = estimateKey(parsedNotes);
      setReferenceMidi({
        fileName: file.name,
        notes: parsedNotes.slice(0, 256),
        estimatedBpm,
        estimatedKey,
        noteCount: parsedNotes.length,
      });
      setBpm(estimatedBpm);
      setKey(estimatedKey);
      setScale('minor');
    } catch (err) {
      setReferenceMidi(null);
      setError(err instanceof Error ? err.message : 'Could not read this MIDI file.');
    } finally {
      setReferenceLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function clearReferenceMidi() {
    setReferenceMidi(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function download() {
    if (!canExport) return;
    stopAllAppAudio();
    downloadMidi(makeMidi(notes, bpm, trackType), midiFileName(trackType, bpm));
  }

  function onDragStart(event: React.DragEvent<HTMLButtonElement>) {
    if (!canExport) return;
    stopAllAppAudio();
    const filename = midiFileName(trackType, bpm);
    const bytes = makeMidi(notes, bpm, trackType);
    const file = new File([bytes.buffer as ArrayBuffer], filename, { type: 'audio/midi' });
    const url = URL.createObjectURL(file);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('DownloadURL', `audio/midi:${filename}:${url}`);
    event.dataTransfer.setData('text/plain', filename);
    try {
      event.dataTransfer.items.add(file);
    } catch {
      // Some browsers only support DownloadURL for dragging files out.
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <main className="px-4 sm:px-6 md:px-8 py-10 sm:py-14">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
              Single-track MIDI
            </p>
            <h1 style={{ color: 'var(--text)', fontFamily: 'Syne, system-ui, sans-serif', fontWeight: 800, fontSize: 'clamp(2.25rem, 6vw, 5rem)', lineHeight: 0.95, letterSpacing: 0 }}>
              Prompt any part.
            </h1>
          </div>
          <p className="max-w-[520px]" style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7 }}>
            Generate melody, arp, bass, pads, drums, chords, or counter-melody as one clean editable MIDI clip.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 18 }}>
            <label style={labelStyle()} htmlFor="midi-prompt">Prompt</label>
            <textarea
              id="midi-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              placeholder="short rolling bass line for dark UK garage, bouncy and offbeat"
              style={{ ...fieldStyle(), resize: 'vertical', minHeight: 150 }}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleReferenceFile(file);
              }}
            />

            <div className="mt-3">
              {referenceMidi ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, margin: 0 }}>
                        {referenceMidi.fileName}
                      </p>
                      <p className="mt-1" style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
                        {detectedLabel(referenceMidi)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent' }}
                      onClick={clearReferenceMidi}
                      aria-label="Remove MIDI reference"
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={referenceLoading}
                >
                  {referenceLoading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
                  {referenceLoading ? 'Reading MIDI...' : 'Upload MIDI reference'}
                </button>
              )}
            </div>

            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors"
              style={{
                border: '1px solid var(--border)',
                background: advancedOpen ? 'var(--surface-strong)' : 'transparent',
                color: 'var(--muted)',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
              aria-expanded={advancedOpen}
              aria-controls="midi-advanced-options"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <SlidersHorizontal size={15} aria-hidden />
              Advanced options
              <ChevronDown
                size={15}
                aria-hidden
                style={{
                  transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </button>

            <div
              id="midi-advanced-options"
              aria-hidden={!advancedOpen}
              style={{
                display: 'grid',
                gridTemplateRows: advancedOpen ? '1fr' : '0fr',
                opacity: advancedOpen ? 1 : 0,
                transform: advancedOpen ? 'translateY(0)' : 'translateY(-4px)',
                transition: 'grid-template-rows 220ms ease, opacity 180ms ease, transform 220ms ease',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle()} htmlFor="midi-key">Key</label>
                    <select id="midi-key" value={key} onChange={(e) => setKey(e.target.value as typeof key)} style={fieldStyle()} tabIndex={advancedOpen ? 0 : -1}>
                      {KEYS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle()} htmlFor="midi-scale">Scale</label>
                    <select id="midi-scale" value={scale} onChange={(e) => setScale(e.target.value as typeof scale)} style={fieldStyle()} tabIndex={advancedOpen ? 0 : -1}>
                      {SCALES.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle()} htmlFor="midi-bpm">BPM</label>
                    <input id="midi-bpm" type="number" min={60} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={fieldStyle()} tabIndex={advancedOpen ? 0 : -1} />
                  </div>
                  <div>
                    <label style={labelStyle()} htmlFor="midi-bars">Bars</label>
                    <input id="midi-bars" type="number" min={1} max={16} value={bars} onChange={(e) => setBars(Number(e.target.value))} style={fieldStyle()} tabIndex={advancedOpen ? 0 : -1} />
                  </div>
                </div>

                <div className="mt-4">
                  <label style={labelStyle()} htmlFor="midi-track-type">Track type</label>
                  <select id="midi-track-type" value={trackType} onChange={(e) => setTrackType(e.target.value as typeof trackType)} style={fieldStyle()} tabIndex={advancedOpen ? 0 : -1}>
                    {TRACK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <SignedIn>
              <button type="button" className="btn-primary mt-5 w-full" onClick={generate} disabled={loading || prompt.trim().length < 3}>
                {loading ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Sparkles size={17} aria-hidden />}
                {loading ? 'Generating MIDI...' : 'Generate MIDI'}
              </button>
            </SignedIn>
            <SignedOut>
              <SignInButtonDeferred mode="modal">
                <button type="button" className="btn-primary mt-5 w-full">
                  <Sparkles size={17} aria-hidden />
                  Sign in to generate
                </button>
              </SignInButtonDeferred>
            </SignedOut>

            {error && (
              <p className="mt-4" style={{ color: '#E94560', fontSize: 14 }}>
                {error}
              </p>
            )}

            {hasGenerated && (
              <div className="mt-5" style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>notes<br /><span style={{ color: 'var(--text)' }}>{notes.length}</span></div>
              </div>
            )}
          </section>

          <section style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(255,109,63,0.12)', color: 'var(--accent)' }}>
                  <Music2 size={18} aria-hidden />
                </div>
                <div>
                  <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>{trackType} editor</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>{key} {scale.replace('_', ' ')} · {bpm} BPM · {bars} bars</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={download} disabled={!canExport}>
                  <Download size={15} aria-hidden />
                  Download MIDI
                </button>
                <button type="button" className="btn-secondary btn-sm" draggable={canExport} onDragStart={onDragStart} disabled={!canExport} title="Drag this button into your DAW">
                  <FileAudio size={15} aria-hidden />
                  Drag MIDI into DAW
                </button>
              </div>
            </div>

            {canExport ? (
              <div className="p-4">
                <PianoRollEditor
                  notes={notes}
                  color="#FF6D3F"
                  bars={bars}
                  layerName={trackType}
                  bpm={bpm}
                  onNotesChange={setNotes}
                  gridHeightPx={360}
                  velocityHeightPx={96}
                  playbackLayer={trackTypeToLayer(trackType)}
                />
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                <div className="max-w-[360px]">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg" style={{ background: 'rgba(255,109,63,0.12)', color: 'var(--accent)' }}>
                    <FileAudio size={22} aria-hidden />
                  </div>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>Your MIDI clip appears here.</p>
                  <p className="mt-2" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                    Generate a part, edit notes and velocities, then export the clip or drag it into your DAW.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
