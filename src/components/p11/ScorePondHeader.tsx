'use client';

import type { MouseEvent, ReactNode } from 'react';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { useOptionalScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

type Props = {
  backHref: string;
  backLabel?: string;
  network: string;
  tokenLabel: string;
  shareAction: ReactNode;
  onBeforeLeave?: () => void;
};

/** 作品水塘首屏导航；分享行为由页面传入，保留既有分享能力。 */
export default function ScorePondHeader({
  backHref,
  backLabel = '返回池塘',
  network,
  tokenLabel,
  shareAction,
  onBeforeLeave,
}: Props) {
  const scoreOrigin = useOptionalScoreOrigin();
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onBeforeLeave?.();
    const origin = scoreOrigin?.origin;
    if (origin?.stage === 'score' && backHref === '/me') scoreOrigin?.beginReturn();
  };
  const home = () => {
    onBeforeLeave?.();
    scoreOrigin?.clear();
  };
  return (
    <header className="score-pond-header" data-pond-ui="true">
      <nav className="score-pond-header__routes" aria-label="离开作品">
        <PondRouteLink className="score-pond-header__back" href={backHref} onClick={back}>
          <span aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </PondRouteLink>
        <PondRouteLink className="score-pond-header__home" href="/" onClick={home}>
          回到水塘
        </PondRouteLink>
      </nav>

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
