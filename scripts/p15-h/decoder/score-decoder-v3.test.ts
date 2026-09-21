import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { join } from 'node:path';
import vm from 'node:vm';
import {
  canonicalizeJson,
  serializeScorePackageV3,
  sha256Hex,
  type JsonValue,
  type ScorePackageV3,
} from '../../../src/lib/score-package';
import { VALID_SOUND_KEYS } from '../../../src/lib/sound-set';

async function main(): Promise<void> {
const htmlPath = join(process.cwd(), 'src', 'score-decoder', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const lines = html.split(/\r?\n/).length;
assert(lines <= 200, `永久 decoder 超过 200 行：${lines}`);
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script, 'decoder 缺少内嵌脚本');

const context = vm.createContext({
  console,
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  Uint8Array,
  ArrayBuffer,
  WeakSet,
  Map,
  Set,
  Promise,
  Number,
  JSON,
  Error,
  setTimeout,
  clearTimeout,
  __RIPPLES_DECODER_TEST__: true,
});
vm.runInContext(script, context, { filename: 'score-decoder/index.html' });
const evaluate = <T>(source: string): T => vm.runInContext(source, context) as T;

const tx = (index: number) => `${index}`.padStart(43, String(index % 10));
const scorePackage: ScorePackageV3 = {
  schema: 'ripples.score-package.v3',
  queueId: '123e4567-e89b-42d3-a456-426614174000',
  contentId: '123e4567-e89b-42d3-a456-426614174001',
  resources: {
    events: { arTxId: tx(1), sha256: '1'.repeat(64), bytes: 100, mime: 'application/json' },
    base: { arTxId: tx(2), sha256: '2'.repeat(64), bytes: 200, mime: 'audio/mpeg' },
    soundSet: { arTxId: tx(3), sha256: '3'.repeat(64), bytes: 300, mime: 'application/json' },
    decoder: { arTxId: tx(4), sha256: '4'.repeat(64), bytes: 400, mime: 'text/html' },
  },
};
const canonicalPackage = serializeScorePackageV3(scorePackage);
const packageSchema = evaluate<string>(
  `parsePackage(enc.encode(${JSON.stringify(canonicalPackage)})).schema`,
);
assert.equal(packageSchema, 'ripples.score-package.v3');
assert.throws(
  () => evaluate(`parsePackage(enc.encode(${JSON.stringify(`${canonicalPackage}\n`)}))`),
  /RFC 8785/,
);
assert.throws(() => evaluate(`canonical({bad:"\\ud800"})`), /invalid Unicode/);

const soundSet = {
  schema: 'ripples.sound-set.v1',
  id: 'current-33-v1',
  sourceCommit: 'f'.repeat(40),
  publicationStatus: 'published',
  keyOrder: VALID_SOUND_KEYS,
  entries: VALID_SOUND_KEYS.map((key, index) => {
    const arTxId = tx(index + 10);
    return {
      key,
      localPath: `public/sounds/${key}.mp3`,
      sha256: (index % 16).toString(16).repeat(64),
      bytes: 1000 + index,
      durationMs: 1000,
      mime: 'audio/mpeg',
      arTxId,
      blobKey: `media/${arTxId}`,
      provenance: { upload: 'verified' },
    };
  }),
};
context.soundSetFixture = soundSet;
assert.equal(evaluate<number>('parseSoundSet(soundSetFixture).size'), 33);
const events = [...VALID_SOUND_KEYS.slice(26)].map((key, index) => ({
  key, time: index * 100, duration: 50,
}));
context.eventsFixture = events;
assert.equal(
  evaluate<number>('parseEvents(eventsFixture,parseSoundSet(soundSetFixture)).length'),
  7,
);
const missingSpace = structuredClone(soundSet);
missingSpace.entries.splice(26, 1);
context.missingSpace = missingSpace;
assert.throws(() => evaluate('parseSoundSet(missingSpace)'), /sound set header/);
context.unknownEvent = [{ key: '2', time: 0, duration: 10 }];
assert.throws(
  () => evaluate('parseEvents(unknownEvent,parseSoundSet(soundSetFixture))'),
  /missing from sound set/,
);

const packageRef = `ar://${tx(90)}`;
assert.equal(
  evaluate<string>(`parseParams(new URLSearchParams("package=${packageRef}")).kind`),
  'package',
);
const legacy = `events=ar://${tx(91)}&base=ar://${tx(92)}&sounds=ar://${tx(93)}`;
assert.equal(evaluate<string>(`parseParams(new URLSearchParams(${JSON.stringify(legacy)})).kind`), 'legacy');
assert.throws(
  () => evaluate(`parseParams(new URLSearchParams(${JSON.stringify(`${legacy}&package=${packageRef}`)}))`),
  /mutually exclusive/,
);

const compatPayload = {
  schema: 'ripples.score-compatibility.v1',
  chainId: 10,
  scoreContract: `0x${'1'.repeat(40)}`,
  tokenId: 2,
  originalTokenURI: `ar://${tx(94)}`,
  original: {
    events: `ar://${tx(95)}`,
    base: `ar://${tx(96)}`,
    sounds: `ar://${tx(97)}`,
  },
  effectiveSounds: Object.fromEntries(events.map(({ key }) => {
    const entry = soundSet.entries.find((item) => item.key === key)!;
    return [key, {
      arTxId: entry.arTxId,
      sha256: entry.sha256,
      bytes: entry.bytes,
      mime: entry.mime,
    }];
  })),
  publishedAt: '2026-09-21T00:00:00.000Z',
  reason: 'Restore the sound identities used at recording time.',
};
const compatManifest = {
  ...compatPayload,
  canonicalDigest: await sha256Hex(canonicalizeJson(compatPayload as JsonValue)),
  signature: `0x${'1'.repeat(130)}`,
};
context.compatBytes = new TextEncoder().encode(JSON.stringify(compatManifest));
assert.equal(
  await evaluate<Promise<number>>('parseCompat(compatBytes).then(value=>value.sounds.size)'),
  7,
);
const damagedCompat = structuredClone(compatManifest);
damagedCompat.reason = 'tampered';
context.damagedCompat = new TextEncoder().encode(JSON.stringify(damagedCompat));
await assert.rejects(
  evaluate<Promise<unknown>>('parseCompat(damagedCompat)'),
  /canonical digest mismatch/,
);
const compatRef = `ar://${tx(98)}`;
assert.equal(
  evaluate<string>(`parseParams(new URLSearchParams("compat=${compatRef}")).kind`),
  'compat',
);
assert.throws(
  () => evaluate(`parseParams(new URLSearchParams("compat=${compatRef}&package=${packageRef}"))`),
  /mutually exclusive/,
);

context.abc = new TextEncoder().encode('abc');
context.abcIdentity = {
  bytes: 3,
  sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  mime: 'application/json',
};
await evaluate<Promise<void>>('verify(abc,abcIdentity,"application/json")');
await assert.rejects(
  evaluate<Promise<void>>('verify(abc,abcIdentity,"audio/mpeg")'),
  /MIME mismatch/,
);
context.damaged = new TextEncoder().encode('abd');
await assert.rejects(
  evaluate<Promise<void>>('verify(damaged,abcIdentity,"application/json")'),
  /SHA-256 mismatch/,
);

for (const marker of ['ripples.score-package.v3', 'ripples.sound-set.v1',
  'ripples.score-compatibility.v1', 'parameters are mutually exclusive',
  'resource SHA-256 mismatch']) {
  assert(html.includes(marker), `decoder 缺少合同：${marker}`);
}

console.log('P15-H3 永久 decoder v3 定向测试通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
