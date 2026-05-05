'use client';

import { useMemo, useState } from 'react';
import { Download, FileAudio, Loader2, Music2, Sparkles, Upload } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { SignInButtonDeferred } from '@/components/ClerkAuthDeferred';
import { PianoRollEditor } from '@/components/PianoRollEditor';
import { downloadMidi, generateMidiFormat0 } from '@/lib/midi-writer';
import { stopAllAppAudio } from '@/lib/audio-control';
import type { NoteEvent } from '@/lib/music-engine';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SCALES = ['minor', 'major', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonic_minor', 'melodic_minor', 'pentatonic_minor', 'pentatonic_major', 'blues'] as const;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SECONDS = 45;
const BASIC_PITCH_SAMPLE_RATE = 22050;

type BasicPitchNote = {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
};

type CleanupResponse = {
  notes: NoteEvent[];
  suggestions: string[];
  model: string;
  usage?: unknown;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function extOk(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith('.wav') || lower.endsWith('.mp3') || lower.endsWith('.m4a');
}

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

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('AudioContext is not available');
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}

async function resampleAudioBuffer(buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) return buffer;
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = Math.max(1, Math.ceil(buffer.duration * targetSampleRate));
  const offline = new OfflineAudioContext(channels, length, targetSampleRate);
  const source = offline.createBufferSource();
  const resampledInput = offline.createBuffer(channels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    resampledInput.copyToChannel(buffer.getChannelData(ch), ch);
  }

  source.buffer = resampledInput;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

function basicPitchToNotes(notes: BasicPitchNote[], bpm: number, bars: number): NoteEvent[] {
  const secondsPerBeat = 60 / bpm;
  const totalBeats = bars * 4;
  return notes
    .map((note) => {
      const startTime = clamp(note.startTimeSeconds / secondsPerBeat, 0, Math.max(0, totalBeats - 0.125));
      const duration = clamp(note.durationSeconds / secondsPerBeat, 0.125, Math.max(0.125, totalBeats - startTime));
      return {
        pitch: clamp(Math.round(note.pitchMidi), 0, 127),
        startTime: Number(startTime.toFixed(3)),
        duration: Number(duration.toFixed(3)),
        velocity: clamp(Math.round(42 + clamp(note.amplitude, 0, 1) * 85), 1, 127),
      };
    })
    .filter((note) => note.duration >= 0.125 && note.startTime < totalBeats)
    .sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);
}

async function runBasicPitch(audioBuffer: AudioBuffer, bpm: number, bars: number, setProgress: (value: string) => void): Promise<NoteEvent[]> {
  const {
    BasicPitch,
    addPitchBendsToNoteEvents,
    noteFramesToTime,
    outputToNotesPoly,
  } = await import('@spotify/basic-pitch');

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  const basicPitch = new BasicPitch('/basic-pitch/model.json');

  await basicPitch.evaluateModel(
    audioBuffer,
    (frameChunk: number[][], onsetChunk: number[][], contourChunk: number[][]) => {
      frames.push(...frameChunk);
      onsets.push(...onsetChunk);
      contours.push(...contourChunk);
    },
    (percent: number) => {
      setProgress(`Basic Pitch ${(percent * 100).toFixed(0)}%`);
    },
  );

  const noteFrames = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
  const bentNotes = addPitchBendsToNoteEvents(contours, noteFrames);
  const timedNotes = noteFramesToTime(bentNotes) as BasicPitchNote[];
  return basicPitchToNotes(timedNotes, bpm, bars);
}

function midiFileName(sourceName: string, bpm: number) {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'transcription';
  return `pulp-${base}-${bpm}bpm.mid`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
}

export function TranscribeClient() {
  const [key, setKey] = useState<(typeof KEYS)[number]>('C');
  const [scale, setScale] = useState<(typeof SCALES)[number]>('minor');
  const [bpm, setBpm] = useState(124);
  const [bars, setBars] = useState(4);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [sourceName, setSourceName] = useState('audio');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [progress, setProgress] = useState('Ready');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExport = notes.length > 0;
  const subtitle = useMemo(() => `${key} ${scale.replace('_', ' ')} · ${bpm} BPM · ${bars} bars`, [bars, bpm, key, scale]);

  async function cleanupWithClaude(inputNotes: NoteEvent[], name: string) {
    setProgress('Claude cleanup...');
    const res = await fetch('/api/postprocess-transcription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: inputNotes, key, scale, bpm, bars, sourceName: name }),
    });
    const data = await res.json() as CleanupResponse | { error?: string };
    if (!res.ok) {
      throw new Error('error' in data && data.error ? data.error : 'Claude cleanup failed');
    }
    return data as CleanupResponse;
  }

  async function processFile(file: File) {
    stopAllAppAudio();
    setError(null);
    setSuggestions([]);
    setNotes([]);
    setRawCount(0);
    setSourceName(file.name);

    if (!extOk(file.name)) {
      setError('Use a WAV, MP3, or M4A file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Max file size is 25 MB.');
      return;
    }

    setLoading(true);
    try {
      setProgress('Decoding audio...');
      const audio = await decodeAudioFile(file);
      if (audio.duration > MAX_SECONDS) {
        throw new Error(`Max duration is ${MAX_SECONDS}s for this workspace.`);
      }
      const modelAudio = await resampleAudioBuffer(audio, BASIC_PITCH_SAMPLE_RATE);

      const estimatedBars = Math.max(1, Math.min(32, Math.ceil(audio.duration / (60 / bpm) / 4)));
      setBars((current) => Math.max(current, estimatedBars));

      setProgress('Running Basic Pitch...');
      const rawNotes = await runBasicPitch(modelAudio, bpm, Math.max(bars, estimatedBars), setProgress);
      if (rawNotes.length === 0) {
        throw new Error('No notes detected. Try a clearer single-instrument recording.');
      }
      setRawCount(rawNotes.length);

      try {
        const cleaned = await cleanupWithClaude(rawNotes, file.name);
        setNotes(cleaned.notes);
        setSuggestions(cleaned.suggestions ?? []);
        setProgress(`Done: ${cleaned.notes.length} cleaned notes`);
      } catch (cleanupError) {
        setNotes(rawNotes);
        setSuggestions(['Claude cleanup was unavailable, so this is the raw Basic Pitch transcription.']);
        setProgress(`Basic Pitch done: ${rawNotes.length} raw notes`);
        setError(cleanupError instanceof Error ? cleanupError.message : 'Claude cleanup failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio transcription failed');
      setProgress('Ready');
    } finally {
      setLoading(false);
    }
  }

  function openPicker() {
    if (loading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.wav,.mp3,.m4a';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void processFile(file);
    };
    input.click();
  }

  function download() {
    if (!canExport) return;
    stopAllAppAudio();
    downloadMidi(generateMidiFormat0(notes, bpm, 'pulp-transcription'), midiFileName(sourceName, bpm));
  }

  function onDragStart(event: React.DragEvent<HTMLButtonElement>) {
    if (!canExport) return;
    stopAllAppAudio();
    const filename = midiFileName(sourceName, bpm);
    const bytes = generateMidiFormat0(notes, bpm, 'pulp-transcription');
    const file = new File([bytes.buffer as ArrayBuffer], filename, { type: 'audio/midi' });
    const url = URL.createObjectURL(file);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('DownloadURL', `audio/midi:${filename}:${url}`);
    event.dataTransfer.setData('text/plain', filename);
    try {
      event.dataTransfer.items.add(file);
    } catch {
      // DownloadURL covers browsers that do not allow adding File items.
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <main className="px-4 py-10 sm:px-6 sm:py-14 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
              Audio to MIDI
            </p>
            <h1 style={{ color: 'var(--text)', fontFamily: 'Syne, system-ui, sans-serif', fontWeight: 800, fontSize: 'clamp(2.25rem, 6vw, 5rem)', lineHeight: 0.95, letterSpacing: 0 }}>
              Turn audio into notes.
            </h1>
          </div>
          <p className="max-w-[560px]" style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7 }}>
            Upload WAV, MP3, or M4A. Spotify Basic Pitch transcribes it, then Claude cleans the MIDI for a tighter piano-roll edit.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 18 }}>
            <div
              className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-5 py-8 text-center transition-colors"
              style={{
                borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void processFile(file);
              }}
              onClick={openPicker}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: 'rgba(255,109,63,0.12)', color: 'var(--accent)' }}>
                {loading ? <Loader2 size={22} className="animate-spin" aria-hidden /> : <Upload size={22} aria-hidden />}
              </div>
              <p style={{ color: 'var(--text)', fontWeight: 700 }}>Drop audio or click to upload</p>
              <p className="mt-2" style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                WAV, MP3, M4A · max 25 MB · max {MAX_SECONDS}s
              </p>
              <p className="mt-4" style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                {progress}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle()} htmlFor="transcribe-key">Key</label>
                <select id="transcribe-key" value={key} onChange={(e) => setKey(e.target.value as typeof key)} style={fieldStyle()} disabled={loading}>
                  {KEYS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle()} htmlFor="transcribe-scale">Scale</label>
                <select id="transcribe-scale" value={scale} onChange={(e) => setScale(e.target.value as typeof scale)} style={fieldStyle()} disabled={loading}>
                  {SCALES.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle()} htmlFor="transcribe-bpm">BPM</label>
                <input id="transcribe-bpm" type="number" min={60} max={220} value={bpm} onChange={(e) => setBpm(clamp(Number(e.target.value), 60, 220))} style={fieldStyle()} disabled={loading} />
              </div>
              <div>
                <label style={labelStyle()} htmlFor="transcribe-bars">Bars</label>
                <input id="transcribe-bars" type="number" min={1} max={32} value={bars} onChange={(e) => setBars(clamp(Number(e.target.value), 1, 32))} style={fieldStyle()} disabled={loading} />
              </div>
            </div>

            <SignedOut>
              <SignInButtonDeferred mode="modal">
                <button type="button" className="btn-primary mt-5 w-full">
                  <Sparkles size={17} aria-hidden />
                  Sign in for Claude cleanup
                </button>
              </SignInButtonDeferred>
            </SignedOut>
            <SignedIn>
              <button type="button" className="btn-secondary mt-5 w-full" onClick={openPicker} disabled={loading}>
                <FileAudio size={17} aria-hidden />
                Choose audio file
              </button>
            </SignedIn>

            {error && (
              <p className="mt-4" style={{ color: '#E94560', fontSize: 14, lineHeight: 1.5 }}>
                {error}
              </p>
            )}

            {canExport && (
              <div className="mt-5 grid grid-cols-2 gap-2" style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>raw notes<br /><span style={{ color: 'var(--text)' }}>{rawCount}</span></div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>clean notes<br /><span style={{ color: 'var(--text)' }}>{notes.length}</span></div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-5" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <p style={{ ...labelStyle(), marginBottom: 10 }}>Suggestions</p>
                <ul className="space-y-2" style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
                  {suggestions.map((item) => <li key={item}>{item}</li>)}
                </ul>
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
                  <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>Transcription editor</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>
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
                  layerName="transcription"
                  bpm={bpm}
                  onNotesChange={setNotes}
                  gridHeightPx={360}
                  velocityHeightPx={96}
                />
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                <div className="max-w-[380px]">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg" style={{ background: 'rgba(255,109,63,0.12)', color: 'var(--accent)' }}>
                    <FileAudio size={22} aria-hidden />
                  </div>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>Your transcription appears here.</p>
                  <p className="mt-2" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                    Upload a single-instrument recording for the cleanest result, then edit the MIDI before exporting.
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
