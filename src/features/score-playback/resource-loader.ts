import type { ScorePlaybackManifest } from '@/src/types/jam';
import { fetchPermanentBytes, fetchPermanentJson, parseSoundsMap } from './sounds-map';
import type { ScorePlaybackResources } from './types';
import { normalizeScoreEvents } from './types';

/** Score 保持自己的全文件兼容路径；这里只共享资源解析，不共享 P14 播放状态机。 */
export async function loadScoreResources(
  manifest: ScorePlaybackManifest,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<ScorePlaybackResources> {
  const [eventsRaw, soundsRaw, baseBytes] = await Promise.all([
    fetchPermanentJson(manifest.eventsRef, fetcher, signal),
    fetchPermanentJson(manifest.soundsMapRef, fetcher, signal),
    fetchPermanentBytes(manifest.baseAudioRef, fetcher, signal),
  ]);
  const events = normalizeScoreEvents(eventsRaw);
  const sounds = parseSoundsMap(soundsRaw);
  const usedKeys = [...new Set(events.map((event) => event.key))];
  const missing = usedKeys.filter((key) => !sounds[key]);
  if (missing.length) throw new Error(`永久音效表缺少事件键：${missing.join('、')}`);
  const soundEntries = await Promise.all(usedKeys.map(async (key) => [
    key,
    await fetchPermanentBytes(`ar://${sounds[key].txId}`, fetcher, signal),
  ] as const));
  return { manifest, events, baseBytes, soundBytes: Object.fromEntries(soundEntries) };
}
