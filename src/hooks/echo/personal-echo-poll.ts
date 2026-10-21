import type { FeaturedEcho, PersonalEchoHomeResponse } from '@/src/types/featured-echo';

type PollOptions = {
  query(signal: AbortSignal): Promise<PersonalEchoHomeResponse>;
  onEcho(echo: FeaturedEcho | null): void;
  onError(error: unknown): void;
  isVisible(): boolean;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  createAbortController(): AbortController;
  intervalMs?: number;
  maxMs?: number;
};

/** pending 自动轮询；本轮结束可唤醒，找到 Echo 或销毁后永久停止。 */
export function createPersonalEchoPoll({
  query, onEcho, onError, isVisible, now, setTimer, clearTimer, createAbortController,
  intervalMs = 30_000, maxMs = 20 * 60_000,
}: PollOptions) {
  let started = false;
  let state: 'idle' | 'polling' | 'found' | 'destroyed' = 'idle';
  let lastRequestedAt: number | null = null;
  let deadline: number | null = null;
  let timer: unknown = null;
  let request: AbortController | null = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function finish(nextState: 'idle' | 'found' | 'destroyed') {
    state = nextState;
    deadline = null;
    cancelTimer();
    request?.abort();
    request = null;
  }

  function terminal() {
    return state === 'found' || state === 'destroyed';
  }

  function expired() {
    if (deadline === null || now() < deadline) return false;
    finish('idle');
    return true;
  }

  function schedule(delay: number) {
    if (state !== 'polling' || deadline === null) return;
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      if (state !== 'polling' || expired()) return;
      if (isVisible()) void execute();
      else schedule(intervalMs);
    }, Math.min(delay, Math.max(0, deadline - now())));
  }

  async function execute() {
    if (terminal() || request || expired()) return;
    cancelTimer();
    const controller = createAbortController();
    request = controller;
    lastRequestedAt = now();
    let nextAt = lastRequestedAt + intervalMs;
    // 💭 为什么不只在响应后计时：慢请求也必须受首次 pending 的绝对期限约束。
    if (deadline !== null) schedule(deadline - now());
    try {
      const response = await query(controller.signal);
      if (terminal() || controller.signal.aborted || expired()) return;
      if (response.echo !== null || !response.pending) {
        finish(response.echo !== null ? 'found' : 'idle');
        onEcho(response.echo);
        return;
      }
      if (deadline === null) {
        deadline = now() + maxMs;
        nextAt = now() + intervalMs;
        state = 'polling';
      }
      onEcho(null);
    } catch (error: unknown) {
      if (terminal() || controller.signal.aborted || expired()) return;
      onError(error);
      if (state !== 'polling') {
        finish('idle');
        onEcho(null);
      }
    } finally {
      // 到期后的旧请求可能迟到，不能清掉新一轮的请求或定时器。
      if (request === controller) {
        request = null;
        if (state === 'polling') schedule(Math.max(0, nextAt - now()));
      }
    }
  }

  return {
    start() {
      if (started || terminal()) return;
      started = true;
      void execute();
    },
    recheck() {
      if (!started || terminal() || !isVisible()) return;
      expired();
      // 冷却只约束本轮结束后的唤醒；轮询中的聚焦仍可立即复查。
      if (state === 'idle' && lastRequestedAt !== null && now() - lastRequestedAt < intervalMs) return;
      void execute();
    },
    stop() { finish('destroyed'); },
    get polling() { return state === 'polling'; },
  };
}
