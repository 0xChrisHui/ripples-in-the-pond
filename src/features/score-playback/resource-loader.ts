import type { ScorePlaybackManifest } from '@/src/types/jam';
import { resolvePermanentMedia } from '@/src/features/permanent-media';
import { fetchPermanentBytes, fetchPermanentJson, parseSoundsMap } from './sounds-map';
import type {
  ScoreAudioIdentity, ScorePlaybackBootstrap, ScorePlaybackResources,
} from './types';
import { normalizeScoreEvents } from './types';

function bootstrapOf(manifest: ScorePlaybackManifest): ScorePlaybackBootstrap | null {
  const value = manifest as Partial<ScorePlaybackBootstrap>;
  return value.schema === 'ripples.score-bootstrap.v1' ? value as ScorePlaybackBootstrap : null;
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

/** Score 保持自己的全文件兼容路径；这里只共享资源解析，不共享 P14 播放状态机。 */
export async function loadScoreResources(
  manifest: ScorePlaybackManifest,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<ScorePlaybackResources> {
  const bootstrap = bootstrapOf(manifest);
  if (bootstrap) {
    const [baseBytes, entries] = await Promise.all([
      fetchSnapshotAudio(bootstrap.base, fetcher, signal),
      Promise.all(Object.entries(bootstrap.sounds).map(async ([key, identity]) => [
        key, await fetchSnapshotAudio(identity, fetcher, signal),
      ] as const)),
    ]);
    return {
      manifest, events: [...bootstrap.events], baseBytes,
      soundBytes: Object.fromEntries(entries),
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
