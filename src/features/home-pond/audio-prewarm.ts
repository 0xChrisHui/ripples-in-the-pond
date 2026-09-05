'use client';

import type { Track } from '@/src/types/tracks';

const PREWARM_LIMIT = 4;
const RANGE_END = 307_199;

type Fetcher = typeof fetch;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
type NetworkNavigator = Navigator & { connection?: { saveData?: boolean } };

/** 真正消费 206 响应，让浏览器有机会复用已验证的音频头部缓存。 */
export async function prewarmAudioUrls(
  urls: readonly string[],
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
  concurrency = 2,
): Promise<number> {
  const queue = [...new Set(urls.filter(Boolean))];
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.min(2, Math.max(1, concurrency), queue.length);
  const worker = async () => {
    while (cursor < queue.length && !signal.aborted) {
      const url = queue[cursor++];
      const response = await fetcher(url, {
        headers: { Range: `bytes=0-${RANGE_END}` },
        signal,
      });
      if (response.status !== 206) {
        await response.body?.cancel();
        continue;
      }
      await response.arrayBuffer();
      completed++;
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  return completed;
}

/** idle 后最多预热四个去重 URL；隐藏、离页或切组都会 AbortController 真取消。 */
export function scheduleAudioPrewarm(tracks: readonly Track[]): () => void {
  const controller = new AbortController();
  const idleWindow = window as IdleWindow;
  const urls = [...new Set(tracks.map((track) => track.audio_url).filter(Boolean))].slice(0, PREWARM_LIMIT);
  let idleId: number | null = null;
  let timerId: number | null = null;
  let started = false;
  const saveData = (navigator as NetworkNavigator).connection?.saveData === true;

  const cancel = () => {
    controller.abort();
    if (idleId != null) idleWindow.cancelIdleCallback?.(idleId);
    if (timerId != null) window.clearTimeout(timerId);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const start = () => {
    if (started || controller.signal.aborted || document.hidden || saveData || urls.length === 0) return;
    started = true;
    void prewarmAudioUrls(urls, controller.signal).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.debug('[home-audio] 低优先预热未完成：', error);
      }
    });
  };
  const schedule = () => {
    if (saveData || controller.signal.aborted || document.hidden) return;
    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(start, { timeout: 2500 });
    } else {
      timerId = window.setTimeout(start, 1200);
    }
  };
  function onVisibility() {
    if (document.hidden) cancel();
    else schedule();
  }

  document.addEventListener('visibilitychange', onVisibility);
  schedule();
  return cancel;
}
