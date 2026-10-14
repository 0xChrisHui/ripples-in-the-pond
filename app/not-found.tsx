import Link from 'next/link';
import EditionStamp from '@/src/components/p11/EditionStamp';
import T from '@/src/i18n/T';

export default function NotFound() {
  return (
    <main
      className="relative grid min-h-svh place-items-center overflow-hidden px-6 text-center"
      data-p11-theme="score"
      style={{ background: 'radial-gradient(ellipse at 50% 58%, #18201a 0%, var(--p11-ink) 54%)', color: 'var(--p11-bone)' }}
    >
      <section className="relative grid max-w-xl justify-items-center gap-5">
        <EditionStamp status="failed" detail="404 · NOT FOUND" />
        <p className="font-mono text-xs tracking-[.24em]" style={{ color: 'var(--p11-brass)' }}>MISSING RECORD</p>
        <h1 className="font-[family-name:var(--p11-font-display)] text-5xl font-light leading-none md:text-7xl"><T k="notFound.title" /></h1>
        <p className="max-w-md text-base leading-7" style={{ color: 'var(--p11-muted)' }}>
          <T k="notFound.description" />
        </p>
        <Link className="mt-3 inline-flex min-h-11 items-center rounded-full border px-6 text-sm" href="/" style={{ borderColor: 'var(--p11-brass)', color: 'var(--p11-bone)' }}>
          <T k="common.backToPond" />
        </Link>
      </section>
    </main>
  );
}
