import type { ScorePlaybackManifest } from '@/src/types/jam';
import { permanentMediaCandidates, resolvePermanentMedia } from '@/src/features/permanent-media';
import { fetchPermanentBytes, fetchPermanentJson, parseSoundsMap } from './sounds-map';
import type {
  ScoreAudioIdentity, ScorePlaybackBootstrap, ScorePlaybackResources,
} from './types';
import { normalizeScoreEvents } from './types';

export const SCORE_STARTUP_WINDOW_MS = 8_000;

function bootstrapOf(manifest: ScorePlaybackManifest): ScorePlaybackBootstrap | null {
  const value = manifest as Partial<ScorePlaybackBootstrap>;
  return value.schema === 'ripples.score-bootstrap.v1' ? value as ScorePlaybackBootstrap : null;
}

export function scoreStreamingBaseUrl(manifest: ScorePlaybackManifest): string | null {
  const bootstrap = bootstrapOf(manifest);
  return bootstrap ? permanentMediaCandidates(bootstrap.base.ref)
    .find(({ source }) => source === 'mirror')?.url ?? null : null;
}

async function fetchSnapshotAudio(
  identity: ScoreAudioIdentity, fetcher: typeof fetch, signal: AbortSignal,
): Promise<ArrayBuffer> {
  const validation = identity.integrity === 'canonical'
    ? { level: 'canonical' as const, sha256: identity.sha256 }
    : { level: 'compatibility' as const, sha256: identity.sha256 };
  const result = await resolvePermanentMedia(identity.ref, {
    kind: 'audio', validation, fetcher, signal, maxBytes: identity.bytes,
  });
  if (result.bytes.byteLength !== identity.bytes) throw new Error('verified snapshot 音频长度不符');
  return result.bytes;
}

export function startupSoundKeys(events: readonly { key: string; time: number }[]): string[] {
  return [...new Set(events.filter(({ time }) => time <= SCORE_STARTUP_WINDOW_MS)
    .map(({ key }) => key))];
}

async function fetchSoundEntries(
  entries: ReadonlyArray<readonly [string, ScoreAudioIdentity]>,
  fetcher: typeof fetch, signal: AbortSignal, concurrency = 4,
): Promise<Array<readonly [string, ArrayBuffer]>> {
  const results: Array<readonly [string, ArrayBuffer]> = new Array(entries.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor; cursor += 1;
      const [key, identity] = entries[index];
      results[index] = [key, await fetchSnapshotAudio(identity, fetcher, signal)];
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return results;
}

/** Score 保持自己的全文件兼容路径；这里只共享资源解析，不共享 P14 播放状态机。 */
export async function loadScoreResources(
  manifest: ScorePlaybackManifest,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<ScorePlaybackResources> {
  const bootstrap = bootstrapOf(manifest);
  if (bootstrap) {
    const startup = new Set(startupSoundKeys(bootstrap.events));
    const ordered = Object.entries(bootstrap.sounds).sort((left, right) => {
      const first = (key: string) => bootstrap.events.find((event) => event.key === key)?.time ?? Infinity;
      return first(left[0]) - first(right[0]);
    });
    const startupEntries = ordered.filter(([key]) => startup.has(key));
    const backgroundEntries = ordered.filter(([key]) => !startup.has(key));
    const streamingBaseUrl = scoreStreamingBaseUrl(bootstrap) ?? undefined;
    const loadBaseBytes = () => fetchSnapshotAudio(bootstrap.base, fetcher, signal);
    const firstSounds = await fetchSoundEntries(startupEntries, fetcher, signal);
    performance.mark('p15:score-startup-closure-ready');
    const backgroundSoundBytes = fetchSoundEntries(backgroundEntries, fetcher, signal)
      .then((entries) => Object.fromEntries(entries));
    return {
      manifest, events: [...bootstrap.events], baseBytes: null,
      soundBytes: Object.fromEntries(firstSounds), backgroundSoundBytes,
      loadBaseBytes, streamingBaseUrl,
    };
  }
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
