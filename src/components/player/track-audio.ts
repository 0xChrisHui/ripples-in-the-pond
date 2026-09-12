import { arweaveGatewayUrls } from '@/src/lib/arweave/shared';
import type { Track } from '@/src/types/tracks';

type AudioTarget = Pick<HTMLAudioElement, 'src' | 'load' | 'play' | 'pause'>;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** 第 36 首只接受由 canonical Arweave 身份推导出的候选。 */
export function getTrackAudioSources(track: Track): string[] {
  const canonical = arweaveGatewayUrls(track.arweave_url);
  const advertised = Array.isArray(track.audio_gateway_urls)
    ? track.audio_gateway_urls.filter((url) => canonical.includes(url))
    : [];
  const permanent = advertised.length > 0 ? advertised : canonical;
  if (track.week === 36) return unique(permanent);
  return unique([...permanent, track.audio_url]);
}

/** 复用同一 HTMLAudio，按顺序做有界 fallback。 */
export async function playTrackSources(
  audio: AudioTarget,
  sources: readonly string[],
  isCurrent: () => boolean,
): Promise<string | null> {
  let lastError: unknown;
  for (const source of sources) {
    if (!isCurrent()) return null;
    audio.src = source;
    audio.load();
    try {
      await audio.play();
      if (!isCurrent()) {
        audio.pause();
        return null;
      }
      return source;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('没有可播放的永久音频网关');
}
