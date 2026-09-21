import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MirrorAsset } from './inventory';
import { readArQuorum, verifyBlob, type FetchLike, type ReadEvidence } from './readback';
import type { BlobWriter } from './vercel-blob';

export type MirrorResult = {
  arTxId: string;
  blobKey: string;
  sources: string[];
  state: 'existing_verified' | 'planned_upload' | 'uploaded_verified';
  arGateways: ReadEvidence[];
  blob?: { full: ReadEvidence; range: ReadEvidence };
};

type RunOptions = {
  assets: MirrorAsset[];
  execute: boolean;
  mirrorBase: string;
  writer: BlobWriter;
  fetcher?: FetchLike;
};

async function probeBlob(
  url: string,
  asset: MirrorAsset,
  fetcher: FetchLike,
): Promise<{ missing: true } | { missing: false; proof: Awaited<ReturnType<typeof verifyBlob>> }> {
  let lastError: unknown;
  for (const delayMs of [0, 500, 1_000, 2_000, 4_000]) {
    if (delayMs) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    try {
      const response = await fetcher(url, {
        method: 'HEAD', headers: { Origin: 'https://pond-ripple.xyz' },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 404) return { missing: true };
      if (response.status === 200) {
        return { missing: false, proof: await verifyBlobEventually(url, asset, fetcher) };
      }
      lastError = new Error(`${url}: Blob 存在性未知（HTTP ${response.status}）`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: Blob 存在性核验失败，禁止上传；${
    lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function uploadVerifiedBytes(
  asset: MirrorAsset,
  bytes: Buffer,
  writer: BlobWriter,
): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ripples-h4-'));
  const localPath = join(tempRoot, `${asset.arTxId}.mp3`);
  try {
    writeFileSync(localPath, bytes, { flag: 'wx' });
    await writer.put(localPath, asset.blobKey, asset.mime);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function verifyBlobEventually(
  url: string, asset: MirrorAsset, fetcher: FetchLike,
): Promise<Awaited<ReturnType<typeof verifyBlob>>> {
  let lastError: unknown;
  for (const delayMs of [0, 1_000, 2_000, 4_000, 8_000]) {
    if (delayMs) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    try {
      return await verifyBlob(url, asset, fetcher);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function runMirror(options: RunOptions): Promise<MirrorResult[]> {
  const fetcher = options.fetcher ?? fetch;
  const results: MirrorResult[] = [];
  for (const asset of options.assets) {
    const ar = await readArQuorum(asset, fetcher);
    const url = `${options.mirrorBase}/${asset.arTxId}`;
    const current = await probeBlob(url, asset, fetcher);
    if (!current.missing) {
      results.push({
        arTxId: asset.arTxId, blobKey: asset.blobKey, sources: asset.sources,
        state: 'existing_verified', arGateways: ar.gateways, blob: current.proof,
      });
      continue;
    }
    if (!options.execute) {
      results.push({
        arTxId: asset.arTxId, blobKey: asset.blobKey, sources: asset.sources,
        state: 'planned_upload', arGateways: ar.gateways,
      });
      continue;
    }
    await uploadVerifiedBytes(asset, ar.bytes, options.writer);
    const proof = await verifyBlobEventually(url, asset, fetcher);
    results.push({
      arTxId: asset.arTxId, blobKey: asset.blobKey, sources: asset.sources,
      state: 'uploaded_verified', arGateways: ar.gateways, blob: proof,
    });
  }
  return results;
}
