'use client';
import Link from 'next/link';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import PageNavigation from '../../pond-shell/navigation/PageNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { MATERIAL_STATUS_COPY, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { getChainDefinition } from '../../../lib/chain/multichain/registry';

export default function MaterialOrderList() {
  const auth = useAuth(), { listOrders } = useMaterialMint(), owner = auth.userId;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const [loaded, setLoaded] = useState<{ owner: string; orders: PublicMaterialOrder[] } | null>(null);
  const [error, setError] = useState<{ owner: string | null; text: string } | null>(null), [busy, setBusy] = useState(false);
  const orders = auth.authenticated && loaded?.owner === owner ? loaded.orders : null;
  const load = useCallback(async () => {
    if (!owner) return; setBusy(true);
    try { const data = await listOrders(); if (currentOwner.current === owner) { setLoaded({ owner, orders: data }); setError(null); } }
    catch (caught) { if (currentOwner.current === owner) setError({ owner, text: caught instanceof Error ? caught.message : '订单读取失败' }); }
    finally { setBusy(false); }
  }, [listOrders, owner]);
  useEffect(() => { if (auth.authenticated) void load(); }, [auth.authenticated, load]);
  return <main className="material-catalog">
    <PageNavigation />
    <nav className="material-header" aria-label="返回私人档案"><PondRouteLink href="/me">← 我的音乐</PondRouteLink></nav>
    <div className="material-intro"><h1>原曲领取订单</h1><p>最近 50 条本人订单；原曲与 Score 订单分开保存。</p></div>
    {!auth.ready ? <p role="status">正在确认登录状态…</p> : !auth.authenticated
      ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后查看本人订单</button>
      : <section className="material-mint">
        <button className="material-collect" type="button" disabled={busy} onClick={() => { void load(); }}>{busy ? '正在读取…' : '刷新订单'}</button>
        {orders === null ? <p role="status">正在读取本人订单…</p> : !orders.length ? <p>尚无 Ethereum 原曲领取订单。</p>
          : <ul>{orders.map(order => <li key={order.orderId}><Link href={`/me/material/${order.orderId}`}>
            {getChainDefinition(order.chainId).displayName} · 原曲 Token #{order.tokenId} · {MATERIAL_STATUS_COPY[order.status]}</Link></li>)}</ul>}
      </section>}
    {auth.authenticated && error?.owner === owner && <p className="material-error" role="alert">{error.text}</p>}
  </main>;
}
