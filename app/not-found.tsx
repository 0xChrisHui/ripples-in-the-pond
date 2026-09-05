import Link from 'next/link';
import EditionStamp from '@/src/components/p11/EditionStamp';

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
        <h1 className="font-[family-name:var(--p11-font-display)] text-5xl font-light leading-none md:text-7xl">这里没有这枚唱片</h1>
        <p className="max-w-md text-base leading-7" style={{ color: 'var(--p11-muted)' }}>
          链接可能有误，或这件作品从未存在。数据库暂时不可用时，我们不会把它误报成 404。
        </p>
        <Link className="mt-3 inline-flex min-h-11 items-center rounded-full border px-6 text-sm" href="/" style={{ borderColor: 'var(--p11-brass)', color: 'var(--p11-bone)' }}>
          ← 返回水塘
        </Link>
      </section>
    </main>
  );
}
