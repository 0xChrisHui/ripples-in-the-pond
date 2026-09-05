import 'server-only';
import { ARWEAVE_GATEWAYS, resolveArUrl } from '@/src/lib/arweave';
import { explorerAddressUrl, explorerTxUrl } from '@/src/lib/chain/chain-config';
import type { ScorePlaybackManifest } from '@/src/types/jam';

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;
const MAX_METADATA_BYTES = 128 * 1024;
const GATEWAY_HOSTS = new Set(ARWEAVE_GATEWAYS.map((gateway) => new URL(gateway).host));

export type ScoreProvenanceSource = 'contract' | 'database' | 'metadata' | 'metadata.animation_url';
export type ScoreProvenanceEntry = {
  value: string | null;
  source: ScoreProvenanceSource;
  href: string | null;
};
export type ScoreProvenance = {
  contract: ScoreProvenanceEntry;
  token: ScoreProvenanceEntry;
  currentHolder: ScoreProvenanceEntry;
  creator: ScoreProvenanceEntry;
  mintTransaction: ScoreProvenanceEntry;
  setUriTransaction: ScoreProvenanceEntry;
  tokenUri: ScoreProvenanceEntry;
  metadata: ScoreProvenanceEntry;
  events: ScoreProvenanceEntry;
  base: ScoreProvenanceEntry;
  sounds: ScoreProvenanceEntry;
  decoder: ScoreProvenanceEntry;
};

export type LoadedScoreMetadata = {
  metadataRef: string;
  manifest: ScorePlaybackManifest;
  name: string | null;
  trackTitle: string | null;
  coverUrl: string | null;
  eventCount: number | null;
  mintedAt: string | null;
};

function arTxId(value: unknown, allowQuery = false): string {
  if (typeof value !== 'string') throw new Error('永久资源引用不是字符串');
  if (value.startsWith('ar://')) {
    const id = value.slice(5);
    if (!TX_ID_RE.test(id)) throw new Error('ar:// 引用不是 43 位 tx id');
    return id;
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('永久资源 URL 无效'); }
  const id = url.pathname.slice(1);
  if (url.protocol !== 'https:' || !GATEWAY_HOSTS.has(url.host)
    || url.username || url.password || url.hash || !TX_ID_RE.test(id)
    || (!allowQuery && url.search)) {
    throw new Error('永久资源必须来自允许的 Arweave 网关');
  }
  return id;
}

function normalizeRef(value: unknown): string {
  return `ar://${arTxId(value)}`;
}

function parseManifest(value: unknown): ScorePlaybackManifest {
  if (typeof value !== 'string') throw new Error('metadata 缺少 animation_url');
  arTxId(value, true);
  const url = new URL(value);
  const allowed = new Set(['events', 'base', 'sounds']);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    throw new Error('animation_url 含未允许参数');
  }
  for (const key of allowed) {
    if (url.searchParams.getAll(key).length !== 1) throw new Error(`animation_url 缺少唯一 ${key}`);
  }
  return {
    permanentDecoderUrl: value,
    eventsRef: normalizeRef(url.searchParams.get('events')),
    baseAudioRef: normalizeRef(url.searchParams.get('base')),
    soundsMapRef: normalizeRef(url.searchParams.get('sounds')),
  };
}

async function readLimitedText(response: Response): Promise<string> {
  const announced = Number(response.headers.get('content-length') ?? 0);
  if (announced > MAX_METADATA_BYTES) throw new Error('metadata 超过 128KiB');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_METADATA_BYTES) {
      await reader.cancel();
      throw new Error('metadata 超过 128KiB');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

async function fetchMetadata(txId: string): Promise<unknown> {
  const errors: string[] = [];
  for (const gateway of ARWEAVE_GATEWAYS) {
    try {
      const response = await fetch(resolveArUrl(txId, gateway), { signal: AbortSignal.timeout(4_000) });
      if (!response.ok) { errors.push(`${gateway}: HTTP ${response.status}`); continue; }
      return JSON.parse(await readLimitedText(response)) as unknown;
    } catch (error) {
      errors.push(`${gateway}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  throw new Error(`永久 metadata 不可用：${errors.join('；')}`);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('metadata 不是对象');
  return value as Record<string, unknown>;
}

function attribute(metadata: Record<string, unknown>, name: string): unknown {
  if (!Array.isArray(metadata.attributes)) return null;
  const item = metadata.attributes.find((value) => {
    const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : null;
    return candidate?.trait_type === name;
  });
  return item && typeof item === 'object' ? (item as Record<string, unknown>).value : null;
}

export async function loadScoreMetadata(reference: string): Promise<LoadedScoreMetadata> {
  const metadataId = arTxId(reference);
  const metadata = record(await fetchMetadata(metadataId));
  const manifest = parseManifest(metadata.animation_url);
  const track = attribute(metadata, 'Track');
  const events = attribute(metadata, 'Events');
  const minted = attribute(metadata, 'Minted At');
  let coverUrl: string | null = null;
  try { coverUrl = resolveArUrl(arTxId(metadata.image)); } catch { /* 封面缺失不否定永久声音。 */ }
  return {
    metadataRef: `ar://${metadataId}`,
    manifest,
    name: typeof metadata.name === 'string' ? metadata.name : null,
    trackTitle: typeof track === 'string' ? track : null,
    coverUrl,
    eventCount: typeof events === 'number' && Number.isSafeInteger(events) ? events : null,
    mintedAt: typeof minted === 'string' ? minted : null,
  };
}

const entry = (value: string | null, source: ScoreProvenanceSource, href: string | null = null) => (
  { value, source, href }
);
function arHref(value: string | null): string | null {
  try { return value ? resolveArUrl(arTxId(value)) : null; } catch { return null; }
}

export function createScoreProvenance(input: {
  contract: string; tokenId: number | null; holder: string | null; creator: string | null;
  mintTx: string | null; setUriTx: string | null; metadataRef: string | null;
  manifest: ScorePlaybackManifest | null; tokenUriSource?: 'contract' | 'database';
}): ScoreProvenance {
  const tokenUri = input.metadataRef;
  return {
    contract: entry(input.contract, 'contract', explorerAddressUrl(input.contract)),
    token: entry(input.tokenId == null ? null : String(input.tokenId), 'contract'),
    currentHolder: entry(input.holder, 'contract', input.holder ? explorerAddressUrl(input.holder) : null),
    creator: entry(input.creator, 'database'),
    mintTransaction: entry(input.mintTx, 'database', input.mintTx ? explorerTxUrl(input.mintTx) : null),
    setUriTransaction: entry(input.setUriTx, 'database', input.setUriTx ? explorerTxUrl(input.setUriTx) : null),
    tokenUri: entry(tokenUri, input.tokenUriSource ?? 'contract', arHref(tokenUri)),
    metadata: entry(input.metadataRef, 'metadata', arHref(input.metadataRef)),
    events: entry(input.manifest?.eventsRef ?? null, 'metadata.animation_url', arHref(input.manifest?.eventsRef ?? null)),
    base: entry(input.manifest?.baseAudioRef ?? null, 'metadata.animation_url', arHref(input.manifest?.baseAudioRef ?? null)),
    sounds: entry(input.manifest?.soundsMapRef ?? null, 'metadata.animation_url', arHref(input.manifest?.soundsMapRef ?? null)),
    decoder: entry(input.manifest?.permanentDecoderUrl ?? null, 'metadata.animation_url', input.manifest?.permanentDecoderUrl ?? null),
  };
}
