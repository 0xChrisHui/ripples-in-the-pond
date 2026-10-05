import { arweaveGatewayUrls } from '@/src/lib/arweave/shared';
import type { Track } from '@/src/types/tracks';
import { originalStreamSource } from '@/src/lib/music-catalog/experience/audio-streams';

type AudioTarget = Pick<HTMLAudioElement, 'src' | 'load' | 'play' | 'pause'> & { error?: MediaError | null };

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** 已核验的同源原曲副本优先；其他播放器的永久网关次序保持不变。 */
export function getTrackAudioSources(track: Track): string[] {
  const canonical = arweaveGatewayUrls(track.arweave_url);
  const local = originalStreamSource(track.id, track.arweave_url);
  const accelerated = track.audio_url === local ? local : undefined;
  const advertised = Array.isArray(track.audio_gateway_urls)
    ? track.audio_gateway_urls.filter((url) => canonical.includes(url))
    : [];
  const permanent = advertised.length > 0 ? advertised : canonical;
  return unique([...(accelerated ? [accelerated] : []), ...permanent, track.audio_url]);
}

/** 仅预载，不调用play；播放时保留同一元素和已缓冲的数据。 */
export function prepareTrackAudio(audio: AudioTarget, sources: readonly string[]): void {
  const source = sources[0];
  if (!source || (audio.src === source && !audio.error)) return;
  audio.src = source;
  audio.load();
}

/** 复用同一 HTMLAudio，按顺序做有界 fallback。 */
export async function playTrackSources(
  audio: AudioTarget,
  sources: readonly string[],
  isCurrent: () => boolean,
  timeoutMs = 5_000,
  onFailure?: (error: Error) => void,
): Promise<string | null> {
  let lastError: unknown;
  for (const source of sources) {
    if (!isCurrent()) return null;
    prepareTrackAudio(audio, [source]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([audio.play(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('音频首声等待超时')), timeoutMs);
      })]);
      if (!isCurrent()) return null;
      return source;
    } catch (error) {
      if (!isCurrent()) return null;
      audio.pause();
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  const failure = lastError instanceof Error ? lastError : new Error('没有可播放的永久音频网关');
  onFailure?.(failure);
  throw failure;
}
