import { useTranslations } from 'next-intl';
import Link from '../pond-shell/PondRouteLink';
import type { EchoArchiveItem } from '@/src/data/echo/types';

// 状态文案在词典 me.echoStatus.<status>
export default function EchoArchiveRow({ echo, index }: { echo: EchoArchiveItem; index: number }) {
  const t = useTranslations('me');
  const href = echo.tokenId ? `/echo/${echo.tokenId}` : `/echo/origin/${echo.originWallet}`;
  return (
    <article className="me-archive-row" data-status={echo.status === 'owned' ? 'finalized' : echo.status}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')}</p>
      <div className="me-archive-row__main"><h3>{echo.name}</h3></div>
      <div className="me-archive-row__state"><span>{t(`echoStatus.${echo.status}`)}</span>{echo.hasError && <small>{t('echoRow.failed')}</small>}</div>
      <Link className="me-archive-row__action" href={href}>
        {echo.tokenId ? t('echoRow.open') : t('echoRow.status')} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
