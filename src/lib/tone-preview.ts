import * as Tone from 'tone'
import type { NoteEvent } from '@/lib/music-engine'

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_NAMES[midi % 12]
  return `${name}${octave}`
}

let activeNodes: Tone.ToneAudioNode[] = []

export async function playTonePreview(
  notes: NoteEvent[],
  bpm: number,
  color?: string,
  onComplete?: () => void
) {
  await Tone.start()
  stopTonePreview()

  const isMelody = color === '#FF6D3F'
  const isChords = color === '#A78BFA'
  const isBass = color === '#00B894'
  const isDrums = color === '#E94560'

  const chain: Tone.ToneAudioNode[] = []
  let synth: Tone.PolySynth | Tone.MembraneSynth

  if (isDrums) {
    synth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -6,
    }).toDestination()
    chain.push(synth)
  } else if (isBass) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 },
      volume: -8,
    }).toDestination()
    const filter = new Tone.Filter(400, 'lowpass').toDestination()
    synth.connect(filter)
    chain.push(synth)
    chain.push(filter)
  } else if (isChords) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0.6, release: 1.5 },
      volume: -14,
    }).toDestination()
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination()
    synth.connect(reverb)
    chain.push(synth)
    chain.push(reverb)
  } else if (isMelody) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.2 },
      volume: -10,
    }).toDestination()
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).toDestination()
    synth.connect(reverb)
    chain.push(synth)
    chain.push(reverb)
  } else {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.2 },
      volume: -10,
    }).toDestination()
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).toDestination()
    synth.connect(reverb)
    chain.push(synth)
    chain.push(reverb)
  }

  activeNodes = chain

  const secondsPerBeat = 60 / bpm
  const now = Tone.now() + 0.1

  let maxEnd = 0
  for (const note of notes) {
    const startTime = now + note.startTime * secondsPerBeat
    const duration = Math.max(0.1, note.duration * secondsPerBeat)
    const noteName = midiToNoteName(note.pitch)
    if (synth instanceof Tone.MembraneSynth) {
      synth.triggerAttackRelease(noteName, duration, startTime, note.velocity / 127)
    } else {
      synth.triggerAttackRelease(noteName, duration, startTime, note.velocity / 127)
    }
    maxEnd = Math.max(maxEnd, note.startTime * secondsPerBeat + duration)
  }

  if (onComplete) {
    setTimeout(() => {
      stopTonePreview()
      onComplete()
    }, (maxEnd + 0.5) * 1000 + 100)
  }
}

export function stopTonePreview() {
  for (const n of activeNodes) {
    try { (n as any).releaseAll?.() } catch {}
    try { n.disconnect() } catch {}
    try { n.dispose() } catch {}
  }
  activeNodes = []
  Tone.Transport.stop()
}
