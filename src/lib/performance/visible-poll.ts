type Visibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

/** 只在页面可见且上一轮完成后继续；恢复可见补查，停止后不再排队。 */
export function startVisiblePolling(
  refresh: () => void | Promise<void>,
  visibility: Visibility,
  delays: readonly number[] = [10_000, 20_000, 30_000],
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false, stopped = false, attempt = 0;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    clear();
    if (!stopped && !visibility.hidden && !running) {
      timer = setTimeout(() => { timer = undefined; void run(); }, delays[Math.min(attempt, delays.length - 1)]);
    }
  };
  const run = async () => {
    if (stopped || visibility.hidden || running) return;
    clear(); running = true;
    try { await refresh(); }
    catch (error) { console.error('状态自动刷新失败：', error); }
    finally { running = false; attempt++; schedule(); }
  };
  const onVisibility = () => { clear(); if (!visibility.hidden) void run(); };
  visibility.addEventListener('visibilitychange', onVisibility);
  schedule();
  return () => { stopped = true; clear(); visibility.removeEventListener('visibilitychange', onVisibility); };
}
