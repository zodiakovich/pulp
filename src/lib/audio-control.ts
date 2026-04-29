import { stopAllPlayback } from '@/lib/mix-engine';
import { closeAudioContext } from '@/lib/audio-context';
import { stopPlayAll, stopTonePreview } from '@/lib/tone-lazy';

const AUDIO_STOP_EVENT = 'pulp:stop-audio';

export function stopAllAppAudio(): void {
  stopTonePreview();
  stopPlayAll();
  stopAllPlayback();
  void closeAudioContext();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUDIO_STOP_EVENT));
  }
}

export function subscribeToAudioStop(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = () => handler();
  window.addEventListener(AUDIO_STOP_EVENT, listener);
  return () => window.removeEventListener(AUDIO_STOP_EVENT, listener);
}
