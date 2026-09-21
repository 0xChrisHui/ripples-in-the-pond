import type { KeyEvent, ScorePlaybackManifest } from '@/src/types/jam';
import { isSoundKey } from '@/src/lib/sound-set';

export type ScorePlaybackState =
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type ScorePlaybackSnapshot = Readonly<{
  state: ScorePlaybackState;
  positionMs: number;
  durationMs: number;
  activeKeys: readonly string[];
  errorMessage: string | null;
  resourceLoadMs: number | null;
  decodeMs: number | null;
  firstSoundExpectedMs: number | null;
}>;

export type ScorePlaybackListener = () => void;

export type NormalizedSound = Readonly<{
  key: string;
  txId: string;
  name: string | null;
}>;

export type NormalizedSoundsMap = Readonly<Record<string, NormalizedSound>>;

export type ScoreAudioIdentity = Readonly<{
  ref: `ar://${string}`;
  sha256: string;
  bytes: number;
  mime: 'audio/mpeg';
  integrity: 'canonical' | 'attested';
}>;

/** 服务端从 active verified snapshot 生成；JSON 已随 HTML/RSC 安全序列化。 */
export type ScorePlaybackBootstrap = ScorePlaybackManifest & Readonly<{
  schema: 'ripples.score-bootstrap.v1';
  events: readonly KeyEvent[];
  base: ScoreAudioIdentity;
  sounds: Readonly<Record<string, ScoreAudioIdentity>>;
}>;

export type ScoreSnapshotReceipt = Readonly<{
  revision: number;
  schemaId: string;
  contentSha256: string;
  verifiedAt: string;
  attestations: Readonly<Record<string, unknown>>;
  compatibility: Readonly<Record<string, unknown>> | null;
}>;

export type ScorePlaybackResources = Readonly<{
  manifest: ScorePlaybackManifest;
  events: readonly KeyEvent[];
  baseBytes: ArrayBuffer;
  soundBytes: Readonly<Record<string, ArrayBuffer>>;
}>;

export interface ScorePlaybackController {
  getSnapshot(): ScorePlaybackSnapshot;
  subscribe(listener: ScorePlaybackListener): () => void;
  load(manifest: ScorePlaybackManifest): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  replay(): Promise<void>;
  destroy(): Promise<void>;
}

export type UseScorePlaybackResult = ScorePlaybackSnapshot & Readonly<{
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  replay: () => Promise<void>;
}>;

export function normalizeScoreEvents(raw: unknown): KeyEvent[] {
  if (!Array.isArray(raw)) throw new Error('永久事件文件必须是数组');
  return raw.map((value, index) => {
    if (typeof value !== 'object' || value === null) throw new Error(`第 ${index + 1} 条事件无效`);
    const item = value as Record<string, unknown>;
    const key = typeof item.key === 'string' ? item.key.trim().toLowerCase() : '';
    const time = typeof item.time === 'number' ? item.time : Number.NaN;
    const duration = typeof item.duration === 'number' ? item.duration : Number.NaN;
    if (!isSoundKey(key) || !Number.isFinite(time) || time < 0
      || !Number.isFinite(duration) || duration < 0) {
      throw new Error(`第 ${index + 1} 条事件字段无效`);
    }
    return { key, time, duration };
  }).sort((a, b) => a.time - b.time);
}
