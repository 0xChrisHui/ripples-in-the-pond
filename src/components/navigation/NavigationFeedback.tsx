'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function eligibleLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || target.download) return null;
  const url = new URL(target.href, location.href);
  if (url.origin !== location.origin || url.href === location.href) return null;
  return target;
}

/** 捕获站内导航意图，立即显示反馈并拦住同一目标的重复提交。 */
export default function NavigationFeedback() {
  const pathname = usePathname();
  const pendingHref = useRef<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    pendingHref.current = null;
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      delete document.documentElement.dataset.routePending;
      resetTimer.current = null;
    }, 160);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = eligibleLink(event);
      if (!link) return;
      if (pendingHref.current === link.href) {
        event.preventDefault();
        return;
      }
      pendingHref.current = link.href;
      document.documentElement.dataset.routePending = 'true';
      performance.mark('p15:navigation-intent');
      resetTimer.current = window.setTimeout(() => {
        pendingHref.current = null;
        delete document.documentElement.dataset.routePending;
      }, 8_000);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
      delete document.documentElement.dataset.routePending;
    };
  }, []);

  return <span className="p15-route-feedback" aria-hidden="true" />;
}
