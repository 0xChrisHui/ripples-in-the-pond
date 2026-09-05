import assert from 'node:assert/strict';
import {
  PermanentMediaError,
  PermanentMediaHealth,
  permanentMediaCandidates,
  resolvePermanentMedia,
} from '../../src/features/permanent-media';
import { fetchPermanentJson } from '../../src/features/score-playback/sounds-map';

const REF = `ar://${'A'.repeat(43)}`;
const AUDIO_HEADERS = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' };

function health(threshold = 2): PermanentMediaHealth {
  return new PermanentMediaHealth({ failureThreshold: threshold, cooldownMs: 60_000 });
}

function response(body: BodyInit, headers: HeadersInit = AUDIO_HEADERS): Response {
  return new Response(body, {
    status: 200,
    headers: { ...AUDIO_HEADERS, ...Object.fromEntries(new Headers(headers)) },
  });
}

async function expectFailure(
  promise: Promise<unknown>,
  kind: PermanentMediaError['kind'],
  attemptKind?: string,
): Promise<PermanentMediaError> {
  try {
    await promise;
    assert.fail(`预期 ${kind} 失败`);
  } catch (error) {
    assert.ok(error instanceof PermanentMediaError);
    assert.equal(error.kind, kind);
    if (attemptKind) assert.ok(error.attempts.every((item) => item.kind === attemptKind));
    return error;
  }
}

async function verifyFallback(): Promise<void> {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://mirror.example/')) return new Response(null, { status: 404 });
    return response('sound');
  };
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: 'https://mirror.example', rounds: 1, health: health(),
  });
  assert.equal(result.source, 'arweave');
  assert.deepEqual(calls.map((url) => new URL(url).host), ['mirror.example', 'arweave.net']);
  assert.deepEqual(
    permanentMediaCandidates(REF, '').map((item) => item.source),
    ['arweave', 'permagate'],
  );

  calls.length = 0;
  const gatewayFallback: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return url.includes('arweave.net') ? new Response(null, { status: 503 }) : response('sound');
  };
  const backup = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: gatewayFallback,
    mirrorBaseUrl: '', rounds: 1, health: health(),
  });
  assert.equal(backup.source, 'permagate');
  assert.deepEqual(calls.map((url) => new URL(url).host), ['arweave.net', 'ario.permagate.io']);
}

async function verifyTimeoutAndAbort(): Promise<void> {
  const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('fetch aborted')), { once: true });
  });
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: hanging,
    mirrorBaseUrl: '', timeoutMs: 2, rounds: 1, health: health(),
  }), 'unavailable', 'timeout');

  const controller = new AbortController();
  const aborted = resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: hanging,
    mirrorBaseUrl: '', timeoutMs: 1_000, signal: controller.signal, health: health(),
  });
  controller.abort(new DOMException('用户取消', 'AbortError'));
  await expectFailure(aborted, 'aborted');
}

async function verifyTypeAndLength(): Promise<void> {
  const badType: typeof fetch = async () => response('html', { 'content-type': 'text/html' });
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: badType,
    mirrorBaseUrl: '', rounds: 1, health: health(),
  }), 'unavailable', 'content-type');

  const noRange: typeof fetch = async () => new Response('sound', {
    headers: { 'content-type': 'audio/mpeg' },
  });
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: noRange,
    mirrorBaseUrl: '', rounds: 1, health: health(),
  }), 'unavailable', 'range');

  const tooLong: typeof fetch = async () => response('x', {
    'content-type': 'audio/mpeg', 'content-length': '99',
  });
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: tooLong,
    mirrorBaseUrl: '', maxBytes: 2, rounds: 1, health: health(),
  }), 'unavailable', 'too-large');

  const hiddenLength: typeof fetch = async () => response('oversized');
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher: hiddenLength,
    mirrorBaseUrl: '', maxBytes: 2, rounds: 1, health: health(),
  }), 'unavailable', 'too-large');
}

async function verifyHash(): Promise<void> {
  const validBytes = new TextEncoder().encode('canonical bytes');
  const digest = await crypto.subtle.digest('SHA-256', validBytes);
  const expected = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
  const fallback: typeof fetch = async (input) => (
    String(input).includes('mirror.example') ? response('wrong bytes') : response(validBytes)
  );
  const resolved = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'canonical', sha256: expected },
    fetcher: fallback, mirrorBaseUrl: 'https://mirror.example', rounds: 1, health: health(),
  });
  assert.equal(resolved.source, 'arweave');
  assert.equal(resolved.verification, 'sha256');

  const alwaysWrong: typeof fetch = async () => response('wrong bytes');
  await expectFailure(resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'canonical', sha256: '0'.repeat(64) },
    fetcher: alwaysWrong, mirrorBaseUrl: '', rounds: 1, health: health(),
  }), 'unavailable', 'hash-mismatch');
}

async function verifyCooldown(): Promise<void> {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return url.includes('mirror.example')
      ? new Response(null, { status: 503 })
      : response('sound');
  };
  const candidateHealth = health(1);
  const options = {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: 'https://mirror.example', rounds: 1, health: candidateHealth,
  } as const;
  await resolvePermanentMedia(REF, options);
  await resolvePermanentMedia(REF, options);
  assert.equal(calls.filter((url) => url.includes('mirror.example')).length, 1);
}

async function verifyScoreCompatibilityErrors(): Promise<void> {
  const malformed: typeof fetch = async () => response('{', { 'content-type': 'application/json' });
  await assert.rejects(fetchPermanentJson(REF, malformed), /永久 JSON 无法解析/);
  const huge: typeof fetch = async () => response('x', {
    'content-type': 'application/json', 'content-length': String(129 * 1024),
  });
  await assert.rejects(fetchPermanentJson(REF, huge), /永久 JSON 超过 128KiB 安全上限/);
}

async function main(): Promise<void> {
  await verifyFallback();
  await verifyTimeoutAndAbort();
  await verifyTypeAndLength();
  await verifyHash();
  await verifyCooldown();
  await verifyScoreCompatibilityErrors();
  console.log('永久媒体 resolver 验证通过');
}

void main();
