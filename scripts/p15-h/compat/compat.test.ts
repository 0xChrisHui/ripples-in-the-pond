import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { privateKeyToAccount } from 'viem/accounts';
import { loadAdminAccount, signPayloadWithAccount, verifyManifestSignature } from './admin';
import { buildPayload, validateCompatibilityManifest } from './contract';
import {
  beginCompatUpload, blockInterruptedCompatUploads, loadCompatLedger,
} from './ledger';
import { loadCompatibilityIdentity, loadCompatibilitySources } from './source';
import type { CompatibilityManifest, CompatUploadLedger } from './types';

async function main(): Promise<void> {
  const sources = loadCompatibilitySources();
  const identity = loadCompatibilityIdentity();
  assert.deepEqual(sources.map(({ tokenId }) => tokenId), [1, 2, 3, 4]);
  assert.equal(sources[0].soundSet, 'legacy-26');
  assert(sources.slice(1).every(({ soundSet }) => soundSet === 'current-33-v1'));
  assert('space' in sources[1].effectiveSounds, 'Score #2 必须恢复真实 space');
  for (const source of sources) {
    assert.deepEqual(Object.keys(source.effectiveSounds), source.usedKeys);
    assert(source.changes.every(({ mode }) => (
      source.tokenId === 1 ? mode === 'retained' : mode === 'override' || mode === 'addition'
    )));
  }

  const payload = buildPayload(sources[1], identity, '2026-09-21T00:00:00.000Z');
  const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
  const manifest = await signPayloadWithAccount(payload, account, 157182094n);
  await validateCompatibilityManifest(manifest);
  assert.equal((await verifyManifestSignature(manifest)).toLowerCase(), account.address.toLowerCase());
  assert.equal(manifest.signature.domain.name, 'RipplesCompatibility');
  assert.equal(manifest.signature.domain.verifyingContract.toLowerCase(), identity.scoreContract.toLowerCase());
  assert.equal(manifest.signature.message.roleBlockNumber, '157182094');

  const wrongRole = structuredClone(manifest) as CompatibilityManifest;
  Object.assign(wrongRole.signature, { adminRole: `0x${'1'.repeat(64)}` });
  await assert.rejects(validateCompatibilityManifest(wrongRole), /基础结构无效/);

  const tampered = structuredClone(manifest) as CompatibilityManifest;
  const firstKey = Object.keys(tampered.effectiveSounds)[0] as keyof typeof tampered.effectiveSounds;
  Object.assign(tampered.effectiveSounds[firstKey]!, { sha256: '0'.repeat(64) });
  await assert.rejects(validateCompatibilityManifest(tampered), /canonical digest mismatch/);

  const decoderHtml = readFileSync(join(process.cwd(), 'src', 'score-decoder', 'index.html'), 'utf8');
  const decoderScript = decoderHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert(decoderScript, 'decoder 缺少脚本');
  const context = vm.createContext({
    console, crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams,
    Uint8Array, ArrayBuffer, WeakSet, Map, Set, Promise, Number, JSON, Error,
    setTimeout, clearTimeout, __RIPPLES_DECODER_TEST__: true,
  });
  vm.runInContext(decoderScript, context);
  context.compatBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const decodedKeys = await vm.runInContext(
    'parseCompat(compatBytes).then(value=>[...value.sounds.keys()])', context,
  ) as string[];
  assert.deepEqual([...decodedKeys], [...sources[1].usedKeys]);

  const previousPath = process.env.ADMIN_WALLET_PATH;
  delete process.env.ADMIN_WALLET_PATH;
  assert.throws(() => loadAdminAccount(), /仓库外绝对路径/);
  if (previousPath) process.env.ADMIN_WALLET_PATH = previousPath;

  const ledgerPath = join(tmpdir(), `ripples-compat-ledger-${process.pid}.json`);
  if (existsSync(ledgerPath)) unlinkSync(ledgerPath);
  const ledger: CompatUploadLedger = {
    schema: 'ripples.compat-upload-ledger.v1', assets: {},
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  beginCompatUpload(ledger, {
    tokenId: manifest.tokenId, bytes: bytes.length,
    contentSha256,
  }, ledgerPath);
  assert.throws(() => blockInterruptedCompatUploads(ledger, ledgerPath), /已熔断/);
  assert.equal(loadCompatLedger(ledgerPath).assets['2'].state, 'upload_result_unknown');
  assert.throws(() => beginCompatUpload(ledger, {
    tokenId: manifest.tokenId, bytes: bytes.length,
    contentSha256,
  }, ledgerPath), /禁止重传/);
  unlinkSync(ledgerPath);

  console.log('P15-H3 compatibility 生成、签名与 durable ledger 测试通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
