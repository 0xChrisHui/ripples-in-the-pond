'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import EditionStamp from '@/src/components/p11/EditionStamp';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => { console.error('[GlobalError]', error); }, [error]);
  return (
    <main
      className="relative grid min-h-svh place-items-center overflow-hidden px-6 text-center"
      data-p11-theme="score"
      style={{ background: 'radial-gradient(ellipse at 50% 58%, #18201a 0%, var(--p11-ink) 54%)', color: 'var(--p11-bone)' }}
    >
      <section className="relative grid max-w-xl justify-items-center gap-5" role="alert">
        <EditionStamp status="failed" detail="SYSTEM INTERRUPTION" />
        <p className="font-mono text-xs tracking-[.24em]" style={{ color: 'var(--p11-brass)' }}>THE POND IS STILL HERE</p>
        <h1 className="font-[family-name:var(--p11-font-display)] text-5xl font-light leading-none md:text-7xl">{t('errorPage.title')}</h1>
        <p className="max-w-md text-base leading-7" style={{ color: 'var(--p11-muted)' }}>
          {t('errorPage.description')}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button className="min-h-11 rounded-full border px-6 text-sm" onClick={reset} style={{ borderColor: 'var(--p11-brass)', color: 'var(--p11-bone)' }}>{t('common.retry')}</button>
          <Link className="inline-flex min-h-11 items-center rounded-full border px-6 text-sm" href="/" style={{ borderColor: 'var(--p11-line-strong)', color: 'var(--p11-muted)' }}>{t('common.backToPondPlain')}</Link>
        </div>
      </section>
    </main>
  );
}
