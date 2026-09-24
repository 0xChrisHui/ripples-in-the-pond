import { ARCHIVE_FIXTURES, fulfillJson } from './fixtures.mjs';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isRsc(request) {
  const headers = Object.fromEntries(Object.entries(request.headers ?? {})
    .map(([key, value]) => [key.toLowerCase(), String(value)]));
  return headers.rsc === '1' || new URL(request.url).searchParams.has('_rsc');
}

export async function createRequestHarness(edge) {
  const { send, on } = edge;
  const state = {
    cold: null,
    intercepted: [],
    writes: [],
    devRequests: [],
  };

  const continueRequest = (requestId) => send('Fetch.continueRequest', { requestId });
  const releaseHeld = async (reason) => {
    const cold = state.cold;
    if (!cold || cold.releasedAt != null) return;
    cold.releasedAt = Date.now();
    cold.releaseReason = reason;
    const held = cold.held.splice(0);
    await Promise.allSettled(held.map((requestId) => continueRequest(requestId)));
  };
  const abortHeld = async (reason) => {
    const cold = state.cold;
    if (!cold || cold.releasedAt != null) return;
    cold.releasedAt = Date.now(); cold.releaseReason = reason;
    const held = cold.held.splice(0);
    await Promise.allSettled(held.map((requestId) => send('Fetch.failRequest', {
      requestId, errorReason: 'Aborted',
    })));
  };

  on('Fetch.requestPaused', (event) => {
    const { request, requestId } = event;
    const url = new URL(request.url);
    const local = url.origin === new URL(process.env.P11_BASE_URL ?? 'http://127.0.0.1:3000').origin;
    state.intercepted.push({ method: request.method, path: url.pathname, rsc: isRsc(request) });
    let task;
    const nextDevRequest = local && url.pathname.startsWith('/__nextjs_');
    if (nextDevRequest && !SAFE_METHODS.has(request.method)) {
      state.devRequests.push({ method: request.method, path: url.pathname });
      task = continueRequest(requestId);
    } else if (local && !SAFE_METHODS.has(request.method)) {
      state.writes.push({ method: request.method, path: url.pathname });
      task = fulfillJson(send, requestId, 405, { error: 'P11-J fixture is read only' });
    } else if (request.method === 'GET' && ARCHIVE_FIXTURES.has(url.pathname)) {
      task = fulfillJson(send, requestId, 200, ARCHIVE_FIXTURES.get(url.pathname));
    } else if (state.cold && url.pathname === state.cold.path && isRsc(request)
      && state.cold.releasedAt == null) {
      state.cold.held.push(requestId);
      state.cold.pausedAt ??= Date.now();
      return;
    } else task = continueRequest(requestId);
    void task.catch(() => undefined);
  });

  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  return {
    state,
    armCold(path, delayMs = 2_000) {
      state.cold = { path, delayMs, armedAt: Date.now(), intentAt: null,
        pausedAt: null, releasedAt: null, releaseReason: null, held: [] };
    },
    activateCold() {
      const cold = state.cold;
      if (!cold) return;
      cold.intentAt = Date.now();
      setTimeout(() => { void releaseHeld('controlled-delay'); }, cold.delayMs);
    },
    async disarmCold() {
      await releaseHeld('cleanup');
      const cold = state.cold;
      state.cold = null;
      return cold;
    },
    async abortCold(reason = 'controlled-abort') {
      await abortHeld(reason);
      const cold = state.cold; state.cold = null; return cold;
    },
  };
}
