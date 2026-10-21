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

/** 只在 pending 后复查；时间、可见性与请求取消均由调用方提供。 */
export function createPersonalEchoPoll({
  query, onEcho, onError, isVisible, now, setTimer, clearTimer, createAbortController,
  intervalMs = 30_000, maxMs = 20 * 60_000,
}: PollOptions) {
  let started = false;
  let stopped = false;
  let polling = false;
  let deadline: number | null = null;
  let timer: unknown = null;
  let request: AbortController | null = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function stop() {
    stopped = true;
    polling = false;
    cancelTimer();
    request?.abort();
  }

  function expired() {
    if (deadline === null || now() < deadline) return false;
    stop();
    return true;
  }

  function schedule(delay: number) {
    if (stopped || deadline === null) return;
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      if (stopped || expired()) return;
      if (isVisible()) void execute();
      else schedule(intervalMs);
    }, Math.min(delay, Math.max(0, deadline - now())));
  }

  async function execute() {
    if (stopped || request || expired()) return;
    cancelTimer();
    const controller = createAbortController();
    request = controller;
    let nextAt = now() + intervalMs;
    // 💭 为什么不只在响应后计时：慢请求也必须受首次 pending 的绝对期限约束。
    if (deadline !== null) schedule(deadline - now());
    try {
      const response = await query(controller.signal);
      if (stopped || controller.signal.aborted || expired()) return;
      if (response.echo !== null || !response.pending) {
        stop();
        onEcho(response.echo);
        return;
      }
      if (deadline === null) {
        deadline = now() + maxMs;
        nextAt = now() + intervalMs;
        polling = true;
      }
      onEcho(null);
    } catch (error: unknown) {
      if (stopped || controller.signal.aborted || expired()) return;
      onError(error);
      if (!polling) {
        stop();
        onEcho(null);
      }
    } finally {
      request = null;
      if (!stopped && polling) schedule(Math.max(0, nextAt - now()));
    }
  }

  return {
    start() {
      if (started || stopped) return;
      started = true;
      void execute();
    },
    recheck() {
      if (!polling || stopped || expired() || !isVisible()) return;
      void execute();
    },
    stop,
    get polling() { return polling; },
  };
}
