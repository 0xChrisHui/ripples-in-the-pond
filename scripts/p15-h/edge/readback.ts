import { sha256 } from '../sound-set-ledger';
import type { MirrorAsset } from './inventory';

export const AR_GATEWAYS = [
  'https://ardrive.net',
  'https://arweave.tokyo',
  'https://arweave.net',
] as const;

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type ReadEvidence = {
  url: string;
  status: number;
  bytes?: number;
  sha256?: string;
  contentType?: string;
  cors?: string | null;
  contentRange?: string | null;
  error?: string;
};

function validMime(value: string | null): boolean {
  return value?.split(';', 1)[0].trim().toLowerCase() === 'audio/mpeg';
}

function validCors(value: string | null): boolean {
  return value === '*' || value === 'https://pond-ripple.xyz';
}

async function fullRead(url: string, fetcher: FetchLike, origin = false): Promise<{ bytes: Buffer; proof: ReadEvidence }> {
  const response = await fetcher(url, {
    ...(origin ? { headers: { Origin: 'https://pond-ripple.xyz' } } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    proof: {
      url,
      status: response.status,
      bytes: bytes.length,
      sha256: sha256(bytes),
      contentType: response.headers.get('content-type') ?? undefined,
      cors: response.headers.get('access-control-allow-origin'),
    },
  };
}

function assertFull(asset: MirrorAsset, proof: ReadEvidence): void {
  if (proof.status !== 200 || proof.bytes !== asset.bytes || proof.sha256 !== asset.sha256
    || !validMime(proof.contentType ?? null)) {
    throw new Error(`${proof.url}: 全字节身份核验失败`);
  }
}

export async function readArQuorum(
  asset: MirrorAsset,
  fetcher: FetchLike = fetch,
): Promise<{ bytes: Buffer; gateways: ReadEvidence[] }> {
  const results = await Promise.all(AR_GATEWAYS.map(async (gateway) => {
    const url = `${gateway}/${asset.arTxId}`;
    try {
      const result = await fullRead(url, fetcher);
      assertFull(asset, result.proof);
      return { ...result, ok: true };
    } catch (error) {
      return {
        bytes: Buffer.alloc(0),
        proof: { url, status: 0, error: error instanceof Error ? error.message : String(error) },
        ok: false,
      };
    }
  }));
  const valid = results.filter((result) => result.ok);
  if (valid.length < 2) throw new Error(`${asset.arTxId}: AR 完整字节未形成双网关共识`);
  return { bytes: valid[0].bytes, gateways: results.map((result) => result.proof) };
}

export async function verifyBlob(
  url: string,
  asset: MirrorAsset,
  fetcher: FetchLike = fetch,
): Promise<{ full: ReadEvidence; range: ReadEvidence }> {
  const full = await fullRead(url, fetcher, true);
  assertFull(asset, full.proof);
  if (!validCors(full.proof.cors ?? null)) throw new Error(`${url}: CORS Gate 失败`);
  const response = await fetcher(url, {
    headers: { Origin: 'https://pond-ripple.xyz', Range: 'bytes=0-0' },
    signal: AbortSignal.timeout(30_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const proof: ReadEvidence = {
    url,
    status: response.status,
    bytes: bytes.length,
    contentType: response.headers.get('content-type') ?? undefined,
    cors: response.headers.get('access-control-allow-origin'),
    contentRange: response.headers.get('content-range'),
  };
  if (proof.status !== 206 || proof.bytes !== 1 || proof.contentRange !== `bytes 0-0/${asset.bytes}`
    || !validMime(proof.contentType ?? null) || !validCors(proof.cors ?? null)) {
    throw new Error(`${url}: Range/CORS/MIME Gate 失败`);
  }
  return { full: full.proof, range: proof };
}
