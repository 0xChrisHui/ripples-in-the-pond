import assert from 'node:assert/strict';
import { canonicalizeJson, sha256Hex, type JsonValue } from '../../../src/lib/score-package';
import {
  parseScoreSnapshot, type ScoreSnapshotRow,
} from '../../../src/data/score/snapshot-contract';
import { loadScoreResources } from '../../../src/features/score-playback/resource-loader';

const encoder = new TextEncoder();
const tx = (value: string) => value.repeat(43);

async function audio(arTxId: string, body: string) {
  const bytes = encoder.encode(body);
  return {
    arTxId, sha256: await sha256Hex(bytes), bytes: bytes.byteLength, mime: 'audio/mpeg' as const,
  };
}

async function rowOf(options: { compatibility?: unknown; omitSpace?: boolean } = {}) {
  const base = await audio(tx('B'), 'base audio');
  const soundA = await audio(tx('A'), 'sound a');
  const soundSpace = await audio(tx('S'), 'sound space');
  const metadata = {
    name: 'Ripples #2', image: `https://arweave.net/${tx('I')}`,
    attributes: [
      { trait_type: 'Track', value: '33' },
      { trait_type: 'Events', value: 2 },
      { trait_type: 'Minted At', value: '2026-09-21' },
    ],
  };
  const events = [
    { key: 'a', time: 0, duration: 100 },
    { key: 'space', time: 500, duration: 120 },
  ];
  const sounds = {
    schema: 'ripples.sound-set.v1',
    entries: [
      { key: 'a', ...soundA },
      ...(options.omitSpace ? [] : [{ key: 'space', ...soundSpace }]),
    ],
  };
  const resourceAttestations = {
    metadata: { arTxId: tx('M'), sha256: '1'.repeat(64), bytes: 100, mime: 'application/json' },
    package: { arTxId: tx('P'), sha256: '2'.repeat(64), bytes: 100, mime: 'application/json' },
    events: { arTxId: tx('E'), sha256: '3'.repeat(64), bytes: 100, mime: 'application/json' },
    soundSet: { arTxId: tx('T'), sha256: '4'.repeat(64), bytes: 100, mime: 'application/json' },
    base,
    decoder: { arTxId: tx('D'), sha256: '5'.repeat(64), bytes: 100, mime: 'text/html' },
  };
  const compatibility = options.compatibility ?? null;
  const digest = {
    schemaId: 'ripples.score-snapshot.v1', originalTokenUri: `ar://${tx('M')}`,
    metadata, events, sounds, resourceAttestations, compatibility,
  };
  const row: ScoreSnapshotRow = {
    revision: 1, queue_id: null, schema_id: digest.schemaId,
    original_token_uri: digest.originalTokenUri, metadata, events, sounds,
    resource_attestations: resourceAttestations, compatibility,
    content_sha256: await sha256Hex(canonicalizeJson(digest as JsonValue)),
    verified_at: '2026-09-21T00:00:00.000Z',
  };
  return { row, bodies: new Map([
    [base.arTxId, 'base audio'], [soundA.arTxId, 'sound a'], [soundSpace.arTxId, 'sound space'],
  ]) };
}

async function verifyBootstrapAndZeroJson(): Promise<void> {
  const fixture = await rowOf();
  const parsed = await parseScoreSnapshot(fixture.row);
  assert.equal(parsed.playbackBootstrap.events.length, 2);
  assert.deepEqual(Object.keys(parsed.playbackBootstrap.sounds), ['a', 'space']);
  assert.equal(parsed.playbackBootstrap.base.integrity, 'canonical');
  assert.match(parsed.manifest.permanentDecoderUrl, /[?]package=ar%3A%2F%2F/);
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    const id = url.split('/').at(-1) ?? '';
    const body = fixture.bodies.get(id);
    if (!body) return new Response(null, { status: 404 });
    return new Response(body, {
      headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' },
    });
  };
  const configuredMirror = process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
  delete process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
  let resources: Awaited<ReturnType<typeof loadScoreResources>>;
  try {
    resources = await loadScoreResources(
      parsed.playbackBootstrap, fetcher, new AbortController().signal,
    );
  } finally {
    if (configuredMirror) process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = configuredMirror;
  }
  assert.equal(resources.events.length, 2);
  assert.equal(calls.length, 3, 'bootstrap 只能请求 base + 两个实际使用音效');
  assert.equal(calls.some((url) => /events|sounds/i.test(url)), false, '浏览器不得请求 JSON');
}

async function verifyCompatibilityAndFailClosed(): Promise<void> {
  const override = await audio(tx('C'), 'compat space');
  const fixture = await rowOf({
    compatibility: {
      schema: 'ripples.score-compatibility.v1',
      effectiveSounds: { space: override },
    },
  });
  const parsed = await parseScoreSnapshot(fixture.row);
  assert.equal(parsed.playbackBootstrap.sounds.space.ref, `ar://${override.arTxId}`);
  assert.equal(parsed.playbackBootstrap.sounds.space.integrity, 'attested');

  const tampered = structuredClone(fixture.row) as ScoreSnapshotRow;
  (tampered.events as Array<{ duration: number }>)[0].duration = 999;
  await assert.rejects(parseScoreSnapshot(tampered), /内容哈希不符/);

  const missing = await rowOf({ omitSpace: true });
  await assert.rejects(parseScoreSnapshot(missing.row), /缺少事件键：space/);
}

async function main(): Promise<void> {
  await verifyBootstrapAndZeroJson();
  await verifyCompatibilityAndFailClosed();
  console.log('P15-H5 verified snapshot/bootstrap 定向测试通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
