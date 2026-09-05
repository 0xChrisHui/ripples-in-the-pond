import type { ReactNode } from 'react';

type Props = {
  backHref: string;
  backLabel?: string;
  network: string;
  tokenLabel: string;
  shareAction: ReactNode;
};

/** 作品水塘首屏导航；分享行为由页面传入，保留既有分享能力。 */
export default function ScorePondHeader({
  backHref,
  backLabel = '返回池塘',
  network,
  tokenLabel,
  shareAction,
}: Props) {
  return (
    <header className="score-pond-header" data-pond-ui="true">
      <a className="score-pond-header__back" href={backHref}>
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </a>

      <p className="score-pond-header__edition" aria-label={`${network}，${tokenLabel}`}>
        <span>{network}</span>
        <span aria-hidden="true">·</span>
        <span>{tokenLabel}</span>
      </p>

      <div className="score-pond-header__share" aria-label="分享作品">
        {shareAction}
      </div>
    </header>
  );
}
