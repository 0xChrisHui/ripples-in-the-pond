'use client';

import type { MouseEvent, ReactNode } from 'react';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { useOptionalScoreOrigin } from '@/src/components/pond-shell/score/score-origin';

type Props = {
  backHref: string;
  backLabel?: string;
  network: string;
  tokenLabel: string;
  shareAction: ReactNode;
  onBeforeBack?: () => void;
};

/** 作品水塘首屏导航；分享行为由页面传入，保留既有分享能力。 */
export default function ScorePondHeader({
  backHref,
  backLabel = '返回池塘',
  network,
  tokenLabel,
  shareAction,
  onBeforeBack,
}: Props) {
  const transition = usePondTransition();
  const scoreOrigin = useOptionalScoreOrigin();
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onBeforeBack?.();
    const origin = scoreOrigin?.origin;
    if (!origin || origin.stage !== 'score' || !transition || backHref !== '/me') return;
    const id = scoreOrigin.beginReturn();
    if (id == null) return;
    event.preventDefault();
    transition.navigate(backHref);
    void scoreOrigin.run(
      () => undefined,
      () => Boolean(document.querySelector(
        `.pond-prepared-archive[data-interactive="true"] [data-score-origin-key="${CSS.escape(origin.key)}"]`,
      )), id,
    );
  };
  return (
    <header className="score-pond-header" data-pond-ui="true">
      <PondRouteLink className="score-pond-header__back" href={backHref} onClick={back}>
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </PondRouteLink>

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
