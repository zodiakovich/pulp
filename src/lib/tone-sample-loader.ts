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
    const bass = new Tone.Sampler({ urls: { C3: 'bass.wav' }, baseUrl });
    const lead = new Tone.Sampler({ urls: { C3: 'lead.wav' }, baseUrl });
    const pad = new Tone.Sampler({ urls: { C3: 'pad.wav' }, baseUrl });

    // Drums — one-shots.
    const kick = new Tone.Player(`${baseUrl}kick.wav`);
    const snare = new Tone.Player(`${baseUrl}snare.wav`);
    const closedHat = new Tone.Player(`${baseUrl}closed-hat.wav`);
    const openHat = new Tone.Player(`${baseUrl}open-hat.wav`);
    const perc = new Tone.Player(`${baseUrl}perc.wav`);

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

