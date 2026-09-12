import Link from 'next/link';
import type { EchoViewData } from '@/src/data/echo/types';
import EchoPlayer from './EchoPlayer';
import EchoProvenance from './EchoProvenance';

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function EchoPage({ echo }: { echo: EchoViewData }) {
  const metadata = echo.metadata;
  const transferred = echo.owner.toLowerCase() !== echo.originWallet.toLowerCase();
  return (
    <main className="echo-page" data-p11-theme="echo">
      <header className="echo-page__nav">
        <Link href="/">← 返回池塘</Link>
        <p>{echo.network} · ECHO #{echo.tokenId}</p>
        <Link href="/me">我的音乐档案</Link>
      </header>

      <section className="echo-hero" aria-labelledby="echo-title">
        <div className="echo-hero__copy">
          <p className="echo-kicker">POND ECHOES · 池中回声</p>
          <h1 id="echo-title">{metadata.name}</h1>
          <p>{metadata.description}</p>
          <dl className="echo-identity">
            <div><dt>原始创作者</dt><dd title={echo.originWallet}>{shortAddress(echo.originWallet)}</dd></div>
            <div><dt>当前持有人</dt><dd title={echo.owner}>{shortAddress(echo.owner)}</dd></div>
          </dl>
          {transferred && <p className="echo-transfer-note">这枚作品已经转让；来源钱包仍永久保留，当前持有人来自链上 ownerOf。</p>}
        </div>
        <div className="echo-hero__art" role="img" aria-label="Pond Echoes 系列永久封面"
          style={{ backgroundImage: `url(${JSON.stringify(echo.imageUrl)})` }}>
          <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
        </div>
      </section>

      <EchoPlayer recipe={metadata.properties.recipe} clips={metadata.properties.clips} />

      <section className="echo-archive">
        <div className="echo-archive__intro">
          <p className="echo-kicker">PERMANENT ARCHIVE</p>
          <h2>一枚作品，两个身份。</h2>
          <p>Origin 记录声音从谁的钱包诞生；owner 记录它此刻在谁手中。转让会改变后者，不会改写前者、配方或 36 段声音。</p>
          <Link href={`/score/${metadata.properties.sourceScoreTokenId}`}>
            打开触发它的首枚 Score #{metadata.properties.sourceScoreTokenId} →
          </Link>
        </div>
        <EchoProvenance echo={echo} />
      </section>
    </main>
  );
}
