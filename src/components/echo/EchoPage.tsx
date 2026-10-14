'use client';

import { useTranslations } from 'next-intl';
import PondRouteLink from '../pond-shell/PondRouteLink';
import type { EchoViewData } from '@/src/data/echo/types';
import EchoPlayer from './EchoPlayer';
import EchoProvenance from './EchoProvenance';

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/** 客户端组件只为让文字随语言切换（P19 F3）；Echo 路由本就是动态渲染，服务端 HTML 仍输出中文 */
export default function EchoPage({ echo }: { echo: EchoViewData }) {
  const t = useTranslations('echo');
  const metadata = echo.metadata;
  const transferred = echo.owner.toLowerCase() !== echo.originWallet.toLowerCase();
  return (
    <main className="echo-page" data-p11-theme="echo">
      <header className="echo-page__nav">
        <p>{echo.network} · ECHO #{echo.tokenId}</p>
      </header>

      <section className="echo-hero" aria-labelledby="echo-title">
        <div className="echo-hero__copy">
          <p className="echo-kicker">{t('kicker')}</p>
          <h1 id="echo-title">{metadata.name}</h1>
          <p>{metadata.description}</p>
          <dl className="echo-identity">
            <div><dt>{t('origin')}</dt><dd title={echo.originWallet}>{shortAddress(echo.originWallet)}</dd></div>
            <div><dt>{t('owner')}</dt><dd title={echo.owner}>{shortAddress(echo.owner)}</dd></div>
          </dl>
          {transferred && <p className="echo-transfer-note">{t('transferred')}</p>}
        </div>
        <div className="echo-hero__art" role="img" aria-label={t('cover')}
          style={{ backgroundImage: `url(${JSON.stringify(echo.imageUrl)})` }}>
          <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
        </div>
      </section>

      <EchoPlayer recipe={metadata.properties.recipe} clips={metadata.properties.clips} />

      <section className="echo-archive" data-pond-no-ripple="true">
        <div className="echo-archive__intro">
          <p className="echo-kicker">PERMANENT ARCHIVE</p>
          <h2>{t('identityTitle')}</h2>
          <p>{t('identityBody')}</p>
          <PondRouteLink href={`/score/${metadata.properties.sourceScoreTokenId}`}>
            {t('sourceScore', { tokenId: metadata.properties.sourceScoreTokenId })}
          </PondRouteLink>
        </div>
        <EchoProvenance echo={echo} />
      </section>
    </main>
  );
}
