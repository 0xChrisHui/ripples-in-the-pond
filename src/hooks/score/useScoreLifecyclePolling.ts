'use client';
import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startVisiblePolling } from '@/src/lib/performance/visible-poll';

/** 页面隐藏时撤销计时器；离开作品页时连同监听一起清理。 */
export function startLifecyclePolling(refresh: () => void | Promise<void>, visibility: EventTarget & { hidden: boolean }) {
  return startVisiblePolling(refresh, visibility);
}

export function useScoreLifecyclePolling(processing: boolean) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pending = useRef(false);
  useEffect(() => { pending.current = isPending; }, [isPending]);
  useEffect(() => {
    if (processing) return startLifecyclePolling(() => {
      if (pending.current) return;
      pending.current = true;
      startTransition(() => router.refresh());
    }, document);
  }, [processing, router, startTransition]);
}
