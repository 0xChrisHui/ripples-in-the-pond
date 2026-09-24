import assert from 'node:assert/strict';
import { PermanentMediaHealth, resolvePermanentMedia } from '../../../src/features/permanent-media';

const REF = `ar://${'R'.repeat(43)}`;
const MIRROR = 'https://mirror.example/media';
const HEADERS = { 'content-type': 'audio/mpeg' };

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

async function verifyMirrorWinsAfterHedge(): Promise<void> {
  let gatewayAborted = false;
  let activeGets = 0;
  let peakGets = 0;
  const requestOrder: string[] = [];
  let mirrorRangeHeader: string | null = '未发起';
  const fetcher: typeof fetch = async (input, init) => {
    const isMirror = String(input).startsWith(MIRROR);
    requestOrder.push(isMirror ? 'mirror' : 'gateway');
    activeGets += 1;
    peakGets = Math.max(peakGets, activeGets);
    if (isMirror) {
      mirrorRangeHeader = new Headers(init?.headers).get('range');
      await wait(30);
      activeGets -= 1;
      return new Response('mirror', { headers: HEADERS });
    }
    return pendingResponse(init?.signal, () => {
      activeGets -= 1;
      gatewayAborted = true;
    });
  };
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' }, fetcher,
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 5, rounds: 1,
    health: new PermanentMediaHealth(),
  });
  assert.equal(result.source, 'mirror');
  assert.equal(requestOrder[0], 'mirror', 'Blob 必须作为第一条请求立即开始');
  assert.equal(mirrorRangeHeader, null, 'Blob 必须直接完整 GET，不发送一字节 Range');
  assert.equal(gatewayAborted, true, '镜像完整验证胜出后必须取消 AR');
  assert.equal(peakGets, 2, '同一对象最多两条完整 GET');
  assert.equal(activeGets, 0, '竞速结束后不得遗留活动 GET');
}

async function verifyGatewayWinsAndAbortsMirror(): Promise<void> {
  let mirrorAborted = false;
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
  });
  assert.equal(result.source, 'ardrive');
  assert.equal(mirrorAborted, true, 'AR 完整验证胜出后必须取消镜像 GET');
}

async function verifyExplicitFailureFallsBackImmediately(): Promise<void> {
  const started = performance.now();
  const result = await resolvePermanentMedia(REF, {
    kind: 'audio', validation: { level: 'compatibility' },
    fetcher: async (input) => String(input).startsWith(MIRROR)
      ? new Response(null, { status: 503 })
      : new Response('gateway', { headers: HEADERS }),
    mirrorBaseUrl: MIRROR, mirrorFallbackDelayMs: 1_000, rounds: 1,
    health: new PermanentMediaHealth(),
  });
  assert.equal(result.source, 'ardrive');
  assert.ok(performance.now() - started < 250, '明确失败必须立即回退，不等待 hedge');
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
    health: new PermanentMediaHealth(),
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
    health: new PermanentMediaHealth(),
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
    health: new PermanentMediaHealth(),
  });
  await wait(8);
  controller.abort();
  await assert.rejects(pending, /取消/);
  assert.equal(mirrorAborted, true);
  assert.equal(gatewayAborted, true);
}

async function verifyConfiguredMirror(): Promise<void> {
  const previous = process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
  process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = MIRROR;
  const calls: string[] = [];
  try {
    const result = await resolvePermanentMedia(REF, {
      kind: 'audio', validation: { level: 'compatibility' },
      fetcher: async (input) => {
        calls.push(String(input));
        if (String(input).startsWith(MIRROR)) return new Response('sound', { headers: HEADERS });
        throw new Error('镜像可用时不应等待永久网关');
      },
      mirrorFallbackDelayMs: 100, rounds: 1, health: new PermanentMediaHealth(),
    });
    assert.equal(result.source, 'mirror');
    assert.deepEqual(calls, [`${MIRROR}/${'R'.repeat(43)}`]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL;
    else process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL = previous;
  }
}

/** 覆盖直接完整 GET、1.2 秒策略、完整验证决胜与竞速败方取消。 */
export async function verifyMirrorRace(): Promise<void> {
  await verifyConfiguredMirror();
  await verifyMirrorWinsAfterHedge();
  await verifyGatewayWinsAndAbortsMirror();
  await verifyExplicitFailureFallsBackImmediately();
  await verifyInvalidFastBranchCannotWin();
  await verifyInvalidGatewayCannotWin();
  await verifyExternalAbortCancelsBoth();
}
