import { permanentMediaCandidates } from './candidates';
import type {
  PermanentMediaCandidate,
  PermanentMediaMirrorProbeContract,
  PermanentMediaMirrorProbeRequest,
} from './types';
const STORAGE_KEY = 'ripples:media-mirror-health:v1';
const DEFAULT_TIMEOUT_MS = 800;
const DEFAULT_HEALTHY_TTL_MS = 60_000;
const DEFAULT_COOLDOWNS = [5 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
type StoredEntry = { level: number; nextProbeAt: number };
type StoredDocument = { schema: 1; entries: Record<string, StoredEntry> };
type ProbeResult = { outcome: 'usable' | 'object-miss' | 'origin-down' | 'aborted'; ref: string };
type Flight = { controller: AbortController; promise: Promise<ProbeResult>;
  waiters: number; settled: boolean };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type MirrorProbeOptions = Readonly<{
  timeoutMs?: number;
  healthyTtlMs?: number;
  cooldownsMs?: readonly number[];
  now?: () => number;
  storage?: StorageLike | null;
}>;
function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function audioType(value: string | null): boolean {
  const type = value?.split(';', 1)[0].trim().toLowerCase();
  return Boolean(type?.startsWith('audio/') || type === 'application/octet-stream');
}
function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('请求已取消', 'AbortError');
}
function parseDocument(raw: string): StoredDocument | null {
  const value = JSON.parse(raw) as Partial<StoredDocument>;
  if (value.schema !== 1 || !value.entries || typeof value.entries !== 'object') return null;
  for (const [origin, entry] of Object.entries(value.entries)) {
    if (new URL(origin).origin !== origin || !Number.isInteger(entry.level) || entry.level < 0
      || !Number.isFinite(entry.nextProbeAt) || entry.nextProbeAt < 0) return null;
  }
  return value as StoredDocument;
}
/** 用真实音频的一字节响应决定本轮是否准入镜像；持久状态不含资源或身份。 */
export class PermanentMediaMirrorProbe implements PermanentMediaMirrorProbeContract {
  private readonly flights = new Map<string, Flight>();
  private readonly memory = new Map<string, StoredEntry>();
  private readonly healthyUntil = new Map<string, number>();
  private readonly timeoutMs: number;
  private readonly healthyTtlMs: number;
  private readonly cooldowns: readonly number[];
  private readonly now: () => number;
  private storage: StorageLike | null;
  constructor(options: MirrorProbeOptions = {}) {
    this.timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.healthyTtlMs = Math.max(0, options.healthyTtlMs ?? DEFAULT_HEALTHY_TTL_MS);
    this.cooldowns = options.cooldownsMs?.length ? options.cooldownsMs : DEFAULT_COOLDOWNS;
    this.now = options.now ?? Date.now;
    this.storage = options.storage === undefined ? browserStorage() : options.storage;
  }
  async select(ref: string, request: PermanentMediaMirrorProbeRequest): Promise<string> {
    if (request.signal?.aborted) throw abortReason(request.signal);
    const candidate = permanentMediaCandidates(ref, request.mirrorBaseUrl)
      .find((item) => item.source === 'mirror');
    if (!candidate) return '';
    const origin = new URL(candidate.url).origin;
    const blocked = this.entry(origin);
    if (blocked && blocked.nextProbeAt > this.now()) {
      performance.mark('p15:ar-fallback-started');
      return '';
    }
    if ((this.healthyUntil.get(origin) ?? 0) > this.now()) return candidate.healthKey;
    const activeFlight = this.flights.get(origin);
    const flight = activeFlight && !activeFlight.controller.signal.aborted
      ? activeFlight : this.startFlight(
      origin, ref, candidate, request.fetcher, request.timeoutMs ?? this.timeoutMs,
      );
    const result = await this.join(flight, request.signal);
    if (result.outcome === 'usable') return candidate.healthKey;
    if (result.outcome === 'object-miss' && result.ref !== ref) return candidate.healthKey;
    if (result.outcome === 'aborted') throw new DOMException('请求已取消', 'AbortError');
    performance.mark('p15:ar-fallback-started');
    return '';
  }
  private startFlight(origin: string, ref: string, candidate: PermanentMediaCandidate,
    fetcher: typeof fetch, timeoutMs: number): Flight {
    const flight: Flight = { controller: new AbortController(), promise: Promise.resolve(
      { outcome: 'aborted', ref } as ProbeResult,
    ), waiters: 0, settled: false };
    performance.mark('p15:mirror-probe-start');
    flight.promise = this.probe(ref, candidate, fetcher, flight.controller, timeoutMs)
      .then((result) => {
        if (result.outcome === 'usable') this.recordSuccess(origin, false);
        else if (result.outcome === 'origin-down') this.recordFailure(origin);
        return result;
      })
      .finally(() => {
        flight.settled = true;
        if (this.flights.get(origin) === flight) this.flights.delete(origin);
        performance.mark('p15:mirror-probe-settled');
      });
    this.flights.set(origin, flight);
    return flight;
  }
  private async probe(ref: string, candidate: PermanentMediaCandidate, fetcher: typeof fetch,
    controller: AbortController, timeoutMs: number): Promise<ProbeResult> {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<ProbeResult>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true; controller.abort();
        resolve({ outcome: 'origin-down', ref });
      }, Math.max(1, timeoutMs));
    });
    const network = (async (): Promise<ProbeResult> => {
    try {
      const response = await fetcher(candidate.url, {
        signal: controller.signal, headers: { Range: 'bytes=0-0' }, cache: 'no-store',
      });
      const range = response.headers.get('content-range');
      const valid = response.status === 206
        && /^bytes 0-0\/[1-9]\d*$/.test(range ?? '')
        && response.headers.get('content-length') === '1'
        && audioType(response.headers.get('content-type'));
      if (!valid) {
        void response.body?.cancel().catch(() => undefined);
        return { outcome: response.status === 404 ? 'object-miss' : 'origin-down', ref };
      }
      const bytes = await response.arrayBuffer();
      return { outcome: bytes.byteLength === 1 ? 'usable' : 'origin-down', ref };
    } catch {
      const outcome = timedOut || !controller.signal.aborted ? 'origin-down' : 'aborted';
      return { outcome, ref };
    }
    })();
    try { return await Promise.race([network, deadline]); }
    finally { if (timer) clearTimeout(timer); }
  }
  private async join(flight: Flight, signal?: AbortSignal): Promise<ProbeResult> {
    if (signal?.aborted) throw abortReason(signal);
    flight.waiters += 1;
    let removeAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      const onAbort = () => reject(abortReason(signal!));
      signal?.addEventListener('abort', onAbort, { once: true });
      removeAbort = () => signal?.removeEventListener('abort', onAbort);
    });
    try { return await Promise.race([flight.promise, aborted]); }
    finally {
      removeAbort?.();
      flight.waiters -= 1;
      if (!flight.settled && flight.waiters === 0) flight.controller.abort();
    }
  }
  private entry(origin: string): StoredEntry | undefined {
    const persisted = this.readDocument().entries[origin];
    if (persisted) this.memory.set(origin, persisted);
    return persisted ?? this.memory.get(origin);
  }
  private recordFailure(origin: string): void {
    this.healthyUntil.delete(origin);
    const previous = this.entry(origin);
    if (previous && previous.nextProbeAt > this.now()) return;
    const level = Math.min((previous?.level ?? -1) + 1, this.cooldowns.length - 1);
    this.writeEntry(origin, { level, nextProbeAt: this.now() + Math.max(0, this.cooldowns[level]) });
  }
  private recordSuccess(origin: string, confirmed: boolean): void {
    this.healthyUntil.set(origin, this.now() + this.healthyTtlMs);
    if (confirmed) this.writeEntry(origin, null);
  }
  recordServiceFailure(mirrorBaseUrl: string): void {
    this.recordFailure(new URL(mirrorBaseUrl).origin);
  }
  recordServiceSuccess(mirrorBaseUrl: string): void {
    this.recordSuccess(new URL(mirrorBaseUrl).origin, true);
  }
  private readDocument(): StoredDocument {
    if (!this.storage) return { schema: 1, entries: {} };
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { schema: 1, entries: {} };
      const value = parseDocument(raw);
      if (value) return value;
    } catch { /* 损坏状态按空处理，绝不能阻断永久回退。 */ }
    try { this.storage.removeItem(STORAGE_KEY); } catch { this.storage = null; }
    return { schema: 1, entries: {} };
  }
  private writeEntry(origin: string, entry: StoredEntry | null): void {
    if (entry) this.memory.set(origin, entry); else this.memory.delete(origin);
    if (!this.storage) return;
    const document = this.readDocument();
    if (entry) document.entries[origin] = entry; else delete document.entries[origin];
    try {
      if (Object.keys(document.entries).length) this.storage.setItem(STORAGE_KEY, JSON.stringify(document));
      else this.storage.removeItem(STORAGE_KEY);
    } catch { this.storage = null; }
  }
}
export const sharedPermanentMediaMirrorProbe = new PermanentMediaMirrorProbe();
