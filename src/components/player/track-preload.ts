import { getTrackAudioSources } from './track-audio';
import type { Track } from '@/src/types/tracks';

const warmed = new Map<string, HTMLAudioElement>();

/** 最多保留两首静音预载；它们从不play，也不接管共享播放器。 */
export function warmTrackAudio(track: Track): void {
  if (typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const sources = getTrackAudioSources(track);
  const url = sources[0];
  if (!url || warmed.has(url)) return;
  if (warmed.size >= 2) {
    const oldest = warmed.keys().next().value;
    if (oldest) {
      const audio = warmed.get(oldest)!;
      audio.removeAttribute('src'); audio.load(); warmed.delete(oldest);
    }
  }
  const audio = new Audio();
  audio.preload = 'auto'; audio.crossOrigin = 'anonymous';
  audio.src = url; audio.load(); warmed.set(url, audio);
}

export function clearTrackWarmup(): void {
  warmed.forEach(audio => { audio.removeAttribute('src'); audio.load(); });
  warmed.clear();
}
