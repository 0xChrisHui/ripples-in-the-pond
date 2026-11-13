'use client';
import { useTranslations } from 'next-intl';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import PageNavigation from '@/src/components/pond-shell/navigation/PageNavigation';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import EditionStamp, { type EditionStatus } from '@/src/components/p11/EditionStamp';

/** 只有真正来自档案的访客才显示返回入口，其余访客共用全站导航。 */
export default function ScoreIdentity({ title, subtitle, network, status, tokenId, onBeforeLeave }: {
  title: string; subtitle?: string; network: string; status: EditionStatus; tokenId?: number | null; onBeforeLeave?: () => void;
}) {
  const t = useTranslations('score');
  const { origin, beginReturn } = useScoreOrigin();
  return <><PageNavigation /><div className="score-pond-page__identity" data-pond-ui="true">
    {origin && origin.tokenId === tokenId && <PondRouteLink className="score-hero__back" href="/me" onClick={() => { onBeforeLeave?.(); beginReturn(); }}>← {t('backToArchive')}</PondRouteLink>}
    <EditionStamp status={status} detail={network} />
    <h1>{title}</h1>
    {subtitle && subtitle !== title && <p>{subtitle}</p>}
  </div></>;
}
