import assetMapJson from './data/asset-map.json';
import { PACK_MAX_SOUNDS } from './contract';

type AssetMap = {
  sounds: Record<string, number>;
  tracks: Record<string, { id: number; catalogId: string }>;
};

/** 纯函数需要的 snapshot 切片：只依赖已验证的 playbackBootstrap，不接受客户端清单。 */
export type PackSource = {
  base: { ref: string; sha256: string };
  sounds: Readonly<Record<string, { sha256: string }>>;
};

export type DerivedPack = {
  trackTokenId: bigint;
  trackCatalogId: string;
  /** 升序、不重复，与合约 _checkSounds 一致 */
  soundIds: bigint[];
};

export class PackDeriveError extends Error {
  constructor(readonly code: 'MISSING_ASSETS' | 'EMPTY_PACK' | 'TOO_MANY_SOUNDS', readonly missing: string[]) {
    super(`${code}: ${missing.join(', ')}`);
  }
}

const DEFAULT_MAP = assetMapJson as AssetMap;

/**
 * 乐谱实际用到的音效 → 按音频 SHA-256 去重 → P22 tokenId；背景音乐按 base 的 Arweave txid 反查 catalog。
 * 任何一项映射缺失都整体拒绝并列出缺口，不静默跳过（计划 §8）。
 */
export function derivePack(source: PackSource, map: AssetMap = DEFAULT_MAP): DerivedPack {
  const missing: string[] = [];
  const ids = new Set<number>();
  for (const [key, identity] of Object.entries(source.sounds)) {
    const id = map.sounds[identity.sha256];
    if (id === undefined) missing.push(`sound:${key}:${identity.sha256.slice(0, 12)}`);
    else ids.add(id);
  }
  const txId = source.base.ref.replace(/^ar:\/\//, '');
  const track = map.tracks[txId];
  if (!track) missing.push(`track:${txId}`);
  if (missing.length > 0) throw new PackDeriveError('MISSING_ASSETS', missing);
  if (ids.size === 0) throw new PackDeriveError('EMPTY_PACK', []);
  if (ids.size > PACK_MAX_SOUNDS) throw new PackDeriveError('TOO_MANY_SOUNDS', [String(ids.size)]);
  return {
    trackTokenId: BigInt(track.id),
    trackCatalogId: track.catalogId,
    soundIds: [...ids].sort((a, b) => a - b).map(BigInt),
  };
}
