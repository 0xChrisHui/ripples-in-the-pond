'use client';

import Link from 'next/link';

/** 无法确认作品身份时的安全壳；不伪造 Token、日期或永久资源。 */
export default function FallbackShell() {
  return (
    <main className="score-fallback" data-p11-theme="score" data-theme="dark" lang="zh-CN">
      <section className="score-fallback__content">
        <span className="score-fallback__mark" aria-hidden="true">○</span>
        <h1>这枚唱片暂时无法读取</h1>
        <p>
          我们没有用占位数据补齐未知信息。你可以重试，或先回到水塘；
          一旦链上与永久资料恢复，原链接会继续有效。
        </p>
        <div className="score-fallback__actions">
          <button type="button" onClick={() => window.location.reload()}>重新读取</button>
          <Link href="/">← 返回水塘</Link>
        </div>
      </section>
    </main>
  );
}
