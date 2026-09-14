import assert from 'node:assert/strict';
import { PermanentMediaHealth, resolvePermanentMedia } from '../../../src/features/permanent-media';

const REF = `ar://${'R'.repeat(43)}`;
const MIRROR = 'https://mirror.example/media';
const HEADERS = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pendingResponse(signal: AbortSignal | null | undefined, onAbort: () => void): Promise<Response> {
  return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => {
    onAbort();
    reject(new DOMException('已取消', 'AbortError'));
  }, { once: true }));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function verifyLateProbeCanStillWin(): Promise<void> {
  let gatewayStartedAt = 0;
  let probeSettledAt = 0;
  let gatewayAborted = false;
  let activeGets = 0;
  let peakGets = 0;
  const fetcher: typeof fetch = async (input, init) => {
    activeGets += 1;
    peakGets = Math.max(peakGets, activeGets);
    if (String(input).startsWith(MIRROR)) {
      await wait(2);
      activeGets -= 1;
      return new Response('mirror', { headers: HEADERS });
    }
    gatewayStartedAt = performance.now();
    return pendingResponse(init?.signal, () => {
      activeGets -= 1;
      gatewayAborted = true;
    });
  };
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 5, rounds: 1,
    health: new PermanentMediaHealth(),
    mirrorProbe: { select: async () => {
      await wait(30);
      probeSettledAt = performance.now();
      return MIRROR;
    } },
  });
  assert.equal(result.source, 'mirror');
  assert.ok(gatewayStartedAt < probeSettledAt, 'AR 必须按 resolver 绝对时钟抢跑');
  assert.equal(gatewayAborted, true, '镜像完整验证胜出后必须取消 AR');
  assert.equal(peakGets, 2, '同一对象最多两条完整 GET');
  assert.equal(activeGets, 0, '竞速结束后不得遗留活动 GET');
}

async function verifyGatewayWinsAndAbortsMirror(): Promise<void> {
  let mirrorAborted = false;
  let serviceFailures = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).startsWith(MIRROR)) {
      return pendingResponse(init?.signal, () => { mirrorAborted = true; });
    }
    return new Response('gateway', { headers: HEADERS });
  };
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 5, mirrorTimeoutMs: 100,
    rounds: 1, health: new PermanentMediaHealth(),
    mirrorProbe: {
      select: async () => MIRROR,
      recordServiceFailure: () => { serviceFailures += 1; },
    },
  });
  assert.equal(result.source, 'ardrive');
  assert.equal(mirrorAborted, true, 'AR 完整验证胜出后必须取消镜像 GET');
  assert.equal(serviceFailures, 0, '竞速败方取消不得写入镜像熔断');
}

async function verifyHangingProbeIsAborted(): Promise<void> {
  let probeAborted = false;
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' },
    fetcher: async () => new Response('gateway', { headers: HEADERS }),
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 5, rounds: 1,
    health: new PermanentMediaHealth(),
    mirrorProbe: { select: async (_ref, request) => new Promise((_resolve, reject) => {
      request.signal?.addEventListener('abort', () => {
        probeAborted = true;
        reject(new DOMException('已取消', 'AbortError'));
      }, { once: true });
    }) },
  });
  assert.equal(result.source, 'ardrive');
  assert.equal(probeAborted, true, 'AR 胜出后必须取消仍在途的探针');
}

async function verifyInvalidFastBranchCannotWin(): Promise<void> {
  const good = new TextEncoder().encode('canonical');
  const expected = await sha256(good);
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'canonical', sha256: expected },
    fetcher: async (input) => new Response(
      String(input).startsWith(MIRROR) ? 'wrong' : good, { headers: HEADERS },
    ),
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 20, rounds: 1,
    health: new PermanentMediaHealth(), mirrorProbe: { select: async () => MIRROR },
  });
  assert.equal(result.source, 'ardrive', '先返回但哈希错误的镜像不得获胜');
}

async function verifyInvalidGatewayCannotWin(): Promise<void> {
  const good = new TextEncoder().encode('canonical mirror');
  const expected = await sha256(good);
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'canonical', sha256: expected },
    fetcher: async (input) => {
      if (!String(input).startsWith(MIRROR)) return new Response('wrong', { headers: HEADERS });
      await wait(15);
      return new Response(good, { headers: HEADERS });
    },
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 2, rounds: 1,
    health: new PermanentMediaHealth(), mirrorProbe: { select: async () => MIRROR },
  });
  assert.equal(result.source, 'mirror', '先返回但哈希错误的 AR 不得获胜');
}

async function verifyExternalAbortCancelsBoth(): Promise<void> {
  let mirrorAborted = false;
  let gatewayAborted = false;
  const controller = new AbortController();
  const fetcher: typeof fetch = async (input, init) => pendingResponse(init?.signal,
    () => { if (String(input).startsWith(MIRROR)) mirrorAborted = true; else gatewayAborted = true; });
  const pending = resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher, signal: controller.signal,
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 2, rounds: 1,
    health: new PermanentMediaHealth(), mirrorProbe: { select: async () => MIRROR },
  });
  await wait(8);
  controller.abort();
  await assert.rejects(pending, /取消/);
  assert.equal(mirrorAborted, true);
  assert.equal(gatewayAborted, true);
}

/** 覆盖有界抢跑、完整验证决胜与竞速败方取消。 */
export async function verifyMirrorRace(): Promise<void> {
  await verifyLateProbeCanStillWin();
  await verifyGatewayWinsAndAbortsMirror();
  await verifyHangingProbeIsAborted();
  await verifyInvalidFastBranchCannotWin();
  await verifyInvalidGatewayCannotWin();
  await verifyExternalAbortCancelsBoth();
}
