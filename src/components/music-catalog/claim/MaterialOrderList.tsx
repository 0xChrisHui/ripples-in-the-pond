'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import PageNavigation from '../../pond-shell/navigation/PageNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useServerText } from '../../../i18n/use-server-text';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import type { PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { getChainDefinition } from '../../../lib/chain/multichain/registry';

export default function MaterialOrderList() {
  const t = useTranslations('material'), serverText = useServerText();
  const auth = useAuth(), { listOrders } = useMaterialMint(), owner = auth.userId;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const [loaded, setLoaded] = useState<{ owner: string; orders: PublicMaterialOrder[] } | null>(null);
  const [error, setError] = useState<{ owner: string | null; text?: string } | null>(null), [busy, setBusy] = useState(false);
  const orders = auth.authenticated && loaded?.owner === owner ? loaded.orders : null;
  const load = useCallback(async () => {
    if (!owner) return; setBusy(true);
    try { const data = await listOrders(); if (currentOwner.current === owner) { setLoaded({ owner, orders: data }); setError(null); } }
    catch (caught) { if (currentOwner.current === owner) setError({ owner, text: caught instanceof Error ? caught.message : undefined }); }
    finally { setBusy(false); }
  }, [listOrders, owner]);
  useEffect(() => { if (auth.authenticated) void load(); }, [auth.authenticated, load]);
  return <main className="material-catalog">
    <PageNavigation />
    <nav className="material-header" aria-label={t('order.listBack')}><PondRouteLink href="/me">{t('order.backLink')}</PondRouteLink></nav>
    <div className="material-intro"><h1>{t('order.listTitle')}</h1><p>{t('order.listIntro')}</p></div>
    {!auth.ready ? <p role="status">{t('order.checkingSignIn')}</p> : !auth.authenticated
      ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>{t('order.signInToView')}</button>
      : <section className="material-mint">
        <button className="material-collect" type="button" disabled={busy} onClick={() => { void load(); }}>{busy ? t('order.listLoading') : t('order.listRefresh')}</button>
        {orders === null ? <p role="status">{t('order.loading')}</p> : !orders.length ? <p>{t('order.listEmpty')}</p>
          : <ul>{orders.map(order => <li key={order.orderId}><Link href={`/me/material/${order.orderId}`}>
            {t('order.listItem', { chain: getChainDefinition(order.chainId).displayName, tokenId: order.tokenId, status: t(`status.${order.status}`) })}</Link></li>)}</ul>}
      </section>}
    {auth.authenticated && error?.owner === owner && <p className="material-error" role="alert">{serverText(error.text, t('order.listFailed'))}</p>}
  </main>;
}
