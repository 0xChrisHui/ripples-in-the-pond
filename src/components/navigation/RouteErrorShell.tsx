'use client';

import { useEffect } from 'react';
import Link from 'next/link';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  eyebrow: string;
  title: string;
  description: string;
  logScope: string;
};

/** 核心路由的诚实错误外壳：保留页面角色、重试动作和返回出口。 */
export default function RouteErrorShell({
  error,
  reset,
  eyebrow,
  title,
  description,
  logScope,
}: Props) {
  useEffect(() => { console.error(`[${logScope}]`, error); }, [error, logScope]);

  return (
    <main
      className="relative grid min-h-svh place-items-center overflow-hidden px-6 text-center"
      data-p11-theme="score"
      style={{
        background: 'radial-gradient(ellipse at 50% 58%, #18201a 0%, var(--p11-ink) 54%)',
        color: 'var(--p11-bone)',
      }}
    >
      <section className="grid max-w-xl justify-items-center gap-5" role="alert">
        <p className="font-mono text-xs tracking-[.24em]" style={{ color: 'var(--p11-brass)' }}>
          {eyebrow}
        </p>
        <h1 className="font-[family-name:var(--p11-font-display)] text-5xl font-light leading-none md:text-7xl">
          {title}
        </h1>
        <p className="max-w-md text-base leading-7" style={{ color: 'var(--p11-muted)' }}>
          {description}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button
            className="min-h-11 rounded-full border px-6 text-sm"
            onClick={reset}
            style={{ borderColor: 'var(--p11-brass)', color: 'var(--p11-bone)' }}
            type="button"
          >
            重新读取
          </button>
          <Link
            className="inline-flex min-h-11 items-center rounded-full border px-6 text-sm"
            href="/"
            style={{ borderColor: 'var(--p11-line-strong)', color: 'var(--p11-muted)' }}
          >
            ← 返回水塘
          </Link>
        </div>
      </section>
    </main>
  );
}
