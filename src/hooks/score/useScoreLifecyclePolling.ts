'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 页面隐藏时撤销计时器；离开作品页时连同监听一起清理。 */
export function startLifecyclePolling(refresh: () => void, visibility: EventTarget & { hidden: boolean }) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const sync = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = visibility.hidden ? undefined : setInterval(refresh, 10_000);
  };
  visibility.addEventListener('visibilitychange', sync);
  sync();
  return () => { if (timer !== undefined) clearInterval(timer); visibility.removeEventListener('visibilitychange', sync); };
}

export function useScoreLifecyclePolling(processing: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (processing) return startLifecyclePolling(() => router.refresh(), document);
  }, [processing, router]);
}
