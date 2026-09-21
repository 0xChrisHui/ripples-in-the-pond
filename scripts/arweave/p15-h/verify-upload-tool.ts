import assert from 'node:assert/strict';
import { VALID_SOUND_KEYS } from '../../../src/lib/sound-set';
import { fullReadbackQuorum, hasFullReadbackQuorum } from './full-readback';
import {
  estimateManifestBytes, readCurrentRegistry, soundAssets, type H3Asset,
} from './sound-set-assets';
import { beginH3Upload, type H3UploadEntry, type H3UploadLedger } from './upload-state';

async function main(): Promise<void> {
  const registry = readCurrentRegistry();
  const assets = soundAssets(registry);
  assert.equal(assets.length, 33);
  assert.deepEqual(assets.map(({ key }) => key), [...VALID_SOUND_KEYS]);
  assert(estimateManifestBytes(registry) <= 65536);

  const first = assets[0];
  let rangeSeen = false;
  const exactFetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    rangeSeen ||= new Headers(init?.headers).has('range');
    return new Response(Uint8Array.from(first.buffer).buffer, {
      status: 200, headers: { 'content-type': first.contentType },
    });
  }) as typeof fetch;
  const exactEvidence = await fullReadbackQuorum('A'.repeat(43), first, exactFetch);
  assert.equal(exactEvidence.length, 2);
  assert(hasFullReadbackQuorum(exactEvidence));
  assert.equal(rangeSeen, false, 'H3 readback 只能使用完整 GET');

  const invalidAsset: H3Asset = { ...first, buffer: Buffer.from('broken') };
  const invalidEvidence = await fullReadbackQuorum('A'.repeat(43), invalidAsset, exactFetch);
  assert.equal(hasFullReadbackQuorum(invalidEvidence), false);

  const unknown: H3UploadEntry = {
    kind: 'sound', key: first.key, fileName: first.fileName, bytes: first.buffer.length,
    contentType: first.contentType, contentSha256: first.sha256,
    state: 'upload_result_unknown', arweaveTxId: null, uploaderAddress: null, costWinc: null,
    attemptedAt: new Date(0).toISOString(), uploadedAt: null, verifiedAt: null,
    lastError: 'unknown', gatewayEvidence: [],
  };
  const ledger: H3UploadLedger = {
    schema: 'ripples.p15-h3-upload-ledger.v1', soundSetId: 'current-33-v1',
    assets: { [`sound:${first.key}`]: unknown },
  };
  assert.throws(() => beginH3Upload(ledger, {
    kind: first.kind, key: first.key, fileName: first.fileName, bytes: first.buffer.length,
    contentType: first.contentType, contentSha256: first.sha256,
  }), /禁止重传/);

  console.log('✅ H3 工具 Gate：33 键、64KB manifest、完整 GET quorum 与 unknown 熔断通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
