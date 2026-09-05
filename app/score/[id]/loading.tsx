import './score-page.css';

export default function ScoreLoading() {
  return (
    <main className="score-pond-page score-pond-page--lifecycle" data-p11-theme="score" data-theme="dark" lang="zh-CN">
      <section className="score-pond-page__hero">
        <div className="score-fallback__content absolute inset-0 m-auto h-fit px-[var(--p11-page-inset)]" role="status">
          <span className="score-fallback__mark" aria-hidden="true">◌</span>
          <h1>正在查找这枚唱片</h1>
          <p>先核对链上身份，再读取它钉住的永久资源。</p>
        </div>
      </section>
      <section className="score-archive" aria-busy="true" aria-label="作品凭证正在准备">
        <div className="score-archive__intro">
          <p className="score-archive__eyebrow">Permanent record · 永久档案</p>
          <h2>作品凭证正在准备</h2>
          <p>作品身份就绪后，这里会显示可核验、可复制的永久来源。</p>
        </div>
      </section>
    </main>
  );
}
