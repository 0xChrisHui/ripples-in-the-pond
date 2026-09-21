import assert from 'node:assert/strict';
import {
  canonicalizeJson,
  hashScorePackageV3,
  parseScorePackageV3,
  parseScorePlaybackParams,
  serializeScorePackageV3,
  sha256Hex,
  verifyScorePackageResource,
  type ScorePackageV3,
} from '../../src/lib/score-package';

async function main(): Promise<void> {
const tx = (character: string) => character.repeat(43);
const packageFixture: ScorePackageV3 = {
  schema: 'ripples.score-package.v3',
  queueId: '123e4567-e89b-42d3-a456-426614174000',
  contentId: '123e4567-e89b-42d3-a456-426614174001',
  resources: {
    events: { arTxId: tx('A'), sha256: '1'.repeat(64), bytes: 123, mime: 'application/json' },
    base: { arTxId: tx('B'), sha256: '2'.repeat(64), bytes: 456, mime: 'audio/mpeg' },
    soundSet: { arTxId: tx('C'), sha256: '3'.repeat(64), bytes: 789, mime: 'application/json' },
    decoder: {
      arTxId: tx('D'), sha256: '4'.repeat(64), bytes: 321, mime: 'text/html; charset=utf-8',
    },
  },
};

const canonicalVector = canonicalizeJson({
  numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
  string: "€$\u000f\nA'B\"\\\"/",
  literals: [null, true, false],
});
assert.equal(
  canonicalVector,
  "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\"/\"}",
);
assert.throws(() => canonicalizeJson({ broken: Number.NaN }), /非有限数字/);
assert.throws(() => canonicalizeJson({ broken: '\ud800' }), /未配对/);

const parsed = parseScorePackageV3(packageFixture);
assert.deepEqual(parsed, packageFixture);
const canonical = serializeScorePackageV3(packageFixture);
assert.equal(serializeScorePackageV3(JSON.parse(canonical)), canonical);
assert.equal(
  await hashScorePackageV3(packageFixture),
  '96ceed0607f51f977fefabb424da612741f25134aa6be771fd45d0d410239543',
);

const invalidMime = structuredClone(packageFixture) as ScorePackageV3;
Object.assign(invalidMime.resources.base, { mime: 'application/json' });
assert.throws(() => parseScorePackageV3(invalidMime), /mime 与角色不匹配/);
const duplicateTx = structuredClone(packageFixture) as ScorePackageV3;
Object.assign(duplicateTx.resources.decoder, { arTxId: duplicateTx.resources.events.arTxId });
assert.throws(() => parseScorePackageV3(duplicateTx), /不同 Arweave tx id/);
assert.throws(
  () => parseScorePackageV3({ ...packageFixture, unexpected: true }),
  /字段必须精确/,
);

const packageParams = new URLSearchParams({ package: `ar://${tx('P')}` });
assert.deepEqual(parseScorePlaybackParams(packageParams), {
  kind: 'package', packageRef: `ar://${tx('P')}`,
});
const legacyParams = new URLSearchParams({
  events: `ar://${tx('E')}`, base: `ar://${tx('F')}`, sounds: `ar://${tx('S')}`,
});
assert.equal(parseScorePlaybackParams(legacyParams).kind, 'legacy');
legacyParams.append('package', `ar://${tx('P')}`);
assert.throws(() => parseScorePlaybackParams(legacyParams), /不得混用/);
assert.throws(
  () => parseScorePlaybackParams(new URLSearchParams({ events: `ar://${tx('E')}` })),
  /必须同时提供/,
);
const duplicatePackage = new URLSearchParams(packageParams);
duplicatePackage.append('package', `ar://${tx('Q')}`);
assert.throws(() => parseScorePlaybackParams(duplicatePackage), /不得重复/);

const bytes = new TextEncoder().encode('{"events":[]}');
const resource = {
  arTxId: tx('R'), sha256: await sha256Hex(bytes), bytes: bytes.byteLength,
  mime: 'application/json' as const,
};
await verifyScorePackageResource(resource, bytes);
await assert.rejects(
  verifyScorePackageResource(resource, new TextEncoder().encode('{"events":[1]}')),
  /字节数不匹配|SHA-256 不匹配/,
);

console.log('P15-H2 score-package.v3 定向测试通过');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
