'use client';

import { useEffect, useState } from 'react';

/** 慢网反馈：等待超过 3 秒才出现一圈极淡的涟漪；不出文字。reduced-motion 下为静态微光。 */
export default function SlowRipple() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div aria-hidden="true" data-pond-slow-ripple="true"
      className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="pond-slow-ripple" />
    </div>
  );
}
