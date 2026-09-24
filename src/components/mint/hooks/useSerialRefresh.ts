import { useEffect, useRef } from 'react';

export function useSerialRefresh(
  refresh: () => Promise<void>,
  paused: boolean,
  onError: (error: unknown) => void,
  delay = 2_000,
): void {
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (paused) return;
    let active = true;
    let timer: number | undefined;
    const run = async () => {
      try { await refresh(); } catch (error) { if (active) onErrorRef.current(error); }
      if (active) timer = window.setTimeout(() => void run(), delay);
    };
    void run();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [delay, paused, refresh]);
}
