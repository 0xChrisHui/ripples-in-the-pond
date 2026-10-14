'use client';

import { useTranslations } from 'next-intl';
import PondRouteLink from '../pond-shell/PondRouteLink';

/** reason 决定说明文案（在词典 echo.unavailable*），服务端页面只传原因，不传中文成品 */
export default function EchoUnavailable({ reason }: { reason: 'token' | 'origin' }) {
  const t = useTranslations('echo');
  return (
    <main className="echo-unavailable" data-p11-theme="echo">
      <p>PERMANENT ARCHIVE · TEMPORARILY UNAVAILABLE</p>
      <h1>{t('unavailableTitle')}</h1>
      <p>{t(reason === 'token' ? 'unavailableToken' : 'unavailableOrigin')}</p>
      <div><PondRouteLink href="/">{t('backToPond')}</PondRouteLink><PondRouteLink href="/me">{t('viewArchive')}</PondRouteLink></div>
    </main>
  );
}
