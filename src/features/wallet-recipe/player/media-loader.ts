import { PermanentMediaError, resolvePermanentMedia } from '@/src/features/permanent-media';
import type { WalletRecipeTimeline } from './timeline';
import type { PlayerError, WalletRecipePlayerInput } from './types';

const LOAD_CONCURRENCY = 4;
const INITIAL_SEGMENT_COUNT = 4;
const DECODE_DURATION_TOLERANCE_MS = 3;

async function fetchPermanentAudio(
  uri: string, expectedSha256: string, fetcher: typeof fetch, signal: AbortSignal,
): Promise<ArrayBuffer> {
  try {
    const result = await resolvePermanentMedia(uri, {
      kind: 'audio', validation: { level: 'canonical', sha256: expectedSha256 },
      fetcher, signal,
    });
    return result.bytes;
  } catch (error) {
    if (signal.aborted) throw signal.reason ?? new DOMException('请求已取消', 'AbortError');
    if (error instanceof PermanentMediaError) {
      const integrity = error.kind === 'hash-mismatch'
        || error.attempts.some((attempt) => attempt.kind === 'hash-mismatch');
      if (integrity) throw Object.assign(
        new Error('音频 SHA-256 与永久 metadata 不一致'), { kind: 'integrity' as const },
      ) satisfies PlayerError;
    }
    if (error instanceof Error && /txId|ar:\/\/|SHA-256/.test(error.message)) {
      throw Object.assign(error, { kind: 'invalid_input' as const }) satisfies PlayerError;
    }
    throw Object.assign(
      new Error('永久音频暂时不可用'), { kind: 'network' as const },
    ) satisfies PlayerError;
  }
}

export async function loadWalletRecipeAudio(
  input: WalletRecipePlayerInput,
  keys: readonly string[],
  fetcher: typeof fetch,
  signal: AbortSignal,
  onLoaded: (loaded: number) => void,
): Promise<Map<string, ArrayBuffer>> {
  const compressed = new Map<string, ArrayBuffer>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < keys.length) {
      const key = keys[cursor++];
      const clip = input.clips[key];
      const bytes = await fetchPermanentAudio(clip.uri, clip.sha256, fetcher, signal);
      compressed.set(key, bytes);
      onLoaded(compressed.size);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(LOAD_CONCURRENCY, keys.length) }, worker,
  ));
  return compressed;
}

export function playbackLoadWindows(timeline: WalletRecipeTimeline): {
  initial: string[];
  remaining: string[];
} {
  const initial = [...new Set(
    timeline.segments.slice(0, INITIAL_SEGMENT_COUNT).map((segment) => segment.key),
  )];
  const initialSet = new Set(initial);
  return { initial, remaining: timeline.uniqueKeys.filter((key) => !initialSet.has(key)) };
}

export async function decodeWalletRecipeAudio(
  context: AudioContext,
  input: WalletRecipePlayerInput,
  compressed: Map<string, ArrayBuffer>,
): Promise<Map<string, AudioBuffer>> {
  const entries = await Promise.all([...compressed].map(async ([key, bytes]) => {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const expectedMs = input.clips[key].durationMs;
    if (Math.abs(buffer.duration * 1000 - expectedMs) > DECODE_DURATION_TOLERANCE_MS) {
      const error = new Error(`音频 ${key} 解码时长与永久 metadata 不一致`);
      throw Object.assign(error, { kind: 'integrity' as const }) satisfies PlayerError;
    }
    return [key, buffer] as const;
  }));
  return new Map(entries);
}
