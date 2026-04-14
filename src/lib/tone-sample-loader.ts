import * as Tone from 'tone';
import { resolveSampleSetSlug, type SampleSetSlug, type ToneLoadedSampleSet } from './sample-sets';

const toneSampleCache = new Map<SampleSetSlug, Promise<ToneLoadedSampleSet>>();

export function resolveToneSampleSlug(genreKey: string): SampleSetSlug | null {
  return resolveSampleSetSlug(genreKey);
}

export async function ensureToneSampleSet(slug: SampleSetSlug): Promise<ToneLoadedSampleSet> {
  const existing = toneSampleCache.get(slug);
  if (existing) return existing;

  const p = (async () => {
    const baseUrl = `/samples/${slug}/`;

    // Pitched instruments — base note C3 so MIDI notes transpose correctly.
    const bass = new Tone.Sampler({ urls: { C3: 'bass.wav' }, baseUrl }).sync();
    const lead = new Tone.Sampler({ urls: { C3: 'lead.wav' }, baseUrl }).sync();
    const pad = new Tone.Sampler({ urls: { C3: 'pad.wav' }, baseUrl }).sync();

    // Drums — one-shots.
    const kick = new Tone.Player(`${baseUrl}kick.wav`).sync();
    const snare = new Tone.Player(`${baseUrl}snare.wav`).sync();
    const closedHat = new Tone.Player(`${baseUrl}closed-hat.wav`).sync();
    const openHat = new Tone.Player(`${baseUrl}open-hat.wav`).sync();
    const perc = new Tone.Player(`${baseUrl}perc.wav`).sync();

    // `retrigger` isn't always present in the public typings, but helps one-shots stack cleanly.
    (kick as any).retrigger = true;
    (snare as any).retrigger = true;
    (closedHat as any).retrigger = true;
    (openHat as any).retrigger = true;
    (perc as any).retrigger = true;

    // Wait for all buffers.
    await Tone.loaded();

    const nodes: Tone.ToneAudioNode[] = [bass, lead, pad, kick, snare, closedHat, openHat, perc];

    return {
      slug,
      samplers: { bass, lead, pad },
      players: { kick, snare, 'closed-hat': closedHat, 'open-hat': openHat, perc },
      nodes,
    };
  })();

  toneSampleCache.set(slug, p);
  return p;
}

export async function preloadToneSamplesForGenre(genreKey: string): Promise<boolean> {
  const slug = resolveToneSampleSlug(genreKey);
  if (!slug) return false;
  await ensureToneSampleSet(slug);
  return true;
}

