import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInventory, type MirrorAsset } from './inventory';
import { runMirror } from './mirror-runner';
import { sha256, type SoundSetLedger } from '../sound-set-ledger';
import type { BlobWriter } from './vercel-blob';

const tx = (char: string) => char.repeat(43);
const soundBytes = Buffer.from('sound-from-ar');
const baseBytes = Buffer.from('base-from-ar');
const mirrorBase = 'https://example.public.blob.vercel-storage.com/media';

function asset(arTxId: string, bytes: Buffer, source: string): MirrorAsset {
  return {
    arTxId,
    blobKey: `media/${arTxId}`,
    bytes: bytes.length,
    sha256: sha256(bytes),
    mime: 'audio/mpeg',
    sources: [source],
  };
}

function response(bytes: Buffer, status = 200, rangeTotal?: number): Response {
  return new Response(status === 404 ? null : new Uint8Array([...bytes]), {
    status,
    headers: {
      'content-type': 'audio/mpeg',
      'access-control-allow-origin': '*',
      ...(rangeTotal ? { 'content-range': `bytes 0-0/${rangeTotal}` } : {}),
    },
  });
}

function harness(existing: Map<string, Buffer>) {
  const uploaded: string[] = [];
  const ar = new Map([[tx('a'), soundBytes], [tx('b'), baseBytes]]);
  const fetcher = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const id = url.slice(url.lastIndexOf('/') + 1);
    if (!url.startsWith(mirrorBase)) return response(ar.get(id) ?? Buffer.alloc(0));
    const bytes = existing.get(id);
    if (init?.method === 'HEAD') return response(Buffer.alloc(0), bytes ? 200 : 404);
    if (!bytes) return response(Buffer.alloc(0), 404);
    if (new Headers(init?.headers).get('range')) return response(bytes.subarray(0, 1), 206, bytes.length);
    return response(bytes);
  };
  const writer: BlobWriter = {
    async put(path, pathname) {
      const id = pathname.slice('media/'.length);
      assert(!existing.has(id), '禁止覆盖已有 Blob');
      existing.set(id, readFileSync(path));
      uploaded.push(pathname);
    },
  };
  return { fetcher, writer, uploaded };
}

async function testRunner(): Promise<void> {
  const assets = [asset(tx('a'), soundBytes, 'sound:a'), asset(tx('b'), baseBytes, 'score:1:base')];
  const dry = harness(new Map([[tx('a'), soundBytes]]));
  const dryResults = await runMirror({ assets, execute: false, mirrorBase, ...dry });
  assert.deepEqual(dryResults.map((item) => item.state), ['existing_verified', 'planned_upload']);
  assert.equal(dry.uploaded.length, 0);

  const live = harness(new Map([[tx('a'), soundBytes]]));
  const liveResults = await runMirror({ assets, execute: true, mirrorBase, ...live });
  assert.deepEqual(liveResults.map((item) => item.state), ['existing_verified', 'uploaded_verified']);
  assert.deepEqual(live.uploaded, [`media/${tx('b')}`]);

  const corrupt = harness(new Map([[tx('a'), Buffer.from('corrupt')]]));
  await assert.rejects(() => runMirror({ assets: assets.slice(0, 1), execute: true, mirrorBase, ...corrupt }));
  assert.equal(corrupt.uploaded.length, 0);
}

function testInventory(): void {
  const template = JSON.parse(readFileSync('data/sound-sets/current-33.json', 'utf8')) as SoundSetLedger;
  const entries = template.entries.map((entry, index) => ({
    ...entry,
    arTxId: String(index).padStart(43, 'A'),
  }));
  const ledger = { ...template, publicationStatus: 'published' as const, manifest: {
    arTxId: tx('m'), sha256: 'f'.repeat(64), bytes: 1, mime: 'application/json' as const,
  }, entries };
  const proof = { ok: true, bytes: baseBytes.length, sha256: sha256(baseBytes), contentType: 'audio/mpeg' };
  const evidence = { scores: [{ tokenId: '1', lifecycle: 'ready', refs: { baseTxId: tx('b') },
    dependencies: [{ txId: tx('b'), kind: 'audio', gateways: [proof, proof] }] }] };
  assert.equal(buildInventory(ledger, evidence).length, 34);
}

void testRunner().then(() => {
  testInventory();
  console.log('H4 Edge 镜像 Gate 测试通过');
});
