'use client';
import Link from 'next/link';
import PondRouteLink from '../pond-shell/PondRouteLink';
import PageNavigation from '../pond-shell/navigation/PageNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress, type Hex } from 'viem';
import { useAuth } from '../../hooks/useAuth';
import { useMaterialMint } from '../../features/material-catalog/mint/useMaterialMint';
import { MATERIAL_STATUS_COPY, canSendMaterialOrder, type PublicMaterialOrder } from '../../features/material-catalog/mint/order-model';
import { readMaterialHash } from '../../features/material-catalog/mint/attempt-cache';
import { getMusicCatalog, getOriginalDeployment } from '../../lib/music-catalog/asset-registry';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';

export default function MaterialOrderView({ orderId, embedded = false }: { orderId: Hex; embedded?: boolean }) {
  const auth = useAuth(), { getOrder, sendOrder, recoverOrder } = useMaterialMint();
  const owner = auth.userId, scope = `${owner}:${orderId}`, activeScope = useRef(scope); activeScope.current = scope;
  const [loaded, setLoaded] = useState<{ owner: string; order: PublicMaterialOrder } | null>(null);
  const [notice, setNotice] = useState<{ scope: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false), [cachedHash, setCachedHash] = useState<Hex | null>(null);
  const [hashInput, setHashInput] = useState<{ scope: string; value: string } | null>(null);
  const enteredHash = hashInput?.scope === scope ? hashInput.value : '';
  const order = auth.authenticated && loaded?.owner === owner && loaded.order.orderId === orderId ? loaded.order : null;
  const load = useCallback(async () => {
    if (!owner) return;
    const next = await getOrder(orderId); if (activeScope.current !== scope) return;
    const cached = readMaterialHash({ userId: owner, environment: getMusicCatalog().environment, chainId: next.chainId,
      contractAddress: next.contractAddress, recipientAddress: next.recipientAddress, orderId });
    setLoaded({ owner, order: next }); setCachedHash(cached); setNotice(null);
  }, [getOrder, orderId, owner, scope]);
  useEffect(() => {
    if (!auth.authenticated) return;
    let active = true;
    void load().catch(error => { if (active && activeScope.current === scope) setNotice({ scope,
      text: error instanceof Error ? error.message : '原曲订单暂不可用' }); });
    return () => { active = false; };
  }, [auth.authenticated, load, scope]);
  async function act(action: 'send' | 'recover' | 'refresh') {
    if (busy) return; setBusy(true); setNotice(null);
    try {
      if (action === 'send') await sendOrder(orderId);
      if (action === 'recover') await recoverOrder(orderId, enteredHash.trim() ? enteredHash.trim().toLowerCase() as Hex : undefined);
      await load();
    } catch (caught) { if (activeScope.current === scope) setNotice({ scope,
      text: caught instanceof Error ? caught.message : '请求暂不可用，请查询已有订单' }); }
    finally { setBusy(false); }
  }
  const deployment = order && getOriginalDeployment(order.trackId, order.chainId);
  const sameWallet = order && auth.walletCapability.walletKind === 'external' && auth.selectedExternalWallet
    && getAddress(auth.selectedExternalWallet.address) === order.recipientAddress;
  const ready = deployment?.status === 'ready' && deployment.contractAddress?.toLowerCase() === order?.contractAddress.toLowerCase();
  const recoverable = order && order.digest && ['sending', 'unknown', 'submitted', 'confirming'].includes(order.status);
  const validHash = /^0x[0-9a-f]{64}$/i.test(enteredHash.trim()) && !/^0x0+$/i.test(enteredHash.trim());
  const asset = ready && deployment?.tokenId === order?.tokenId ? deployment.publicPlaybackUrl : null;
  const Container = embedded ? 'section' : 'main';
  return <Container className={embedded ? 'material-inline-claim' : 'material-catalog'} data-material-claim-inline={embedded || undefined}>
    {!embedded && <><PageNavigation />
      <nav className="material-header" aria-label="返回我的音乐"><PondRouteLink href="/me">← 我的音乐</PondRouteLink></nav>
      <div className="material-intro"><h1>原曲领取状态</h1><p>已有交易只查询或恢复，不重复发送。</p></div></>}
    {!auth.ready ? <p role="status">正在确认登录状态…</p> : !auth.authenticated
      ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后查看本人订单</button>
      : <section className="material-mint" aria-live="polite">
        {!order ? <p>正在读取本人订单…</p> : <>
          <h2>{MATERIAL_STATUS_COPY[order.status]}</h2>
          <p>{getChainDefinition(order.chainId).displayName} · 原曲 Token #{order.tokenId} · 数量 1</p>
          <p className="material-uri">接收地址：{order.recipientAddress}</p><p className="material-muted">Gas 由此钱包支付，额外领取价格为零。</p>
          <p className="material-uri">合约：<a href={explorerAddressUrlFor(order.chainId, order.contractAddress)} target="_blank" rel="noreferrer">{order.contractAddress}</a></p>
          {order.txHash && <p className="material-uri">交易：<a href={explorerTxUrlFor(order.chainId, order.txHash)} target="_blank" rel="noreferrer">{order.txHash}</a></p>}
          {canSendMaterialOrder(order) && !cachedHash && <button className="material-collect" type="button" disabled={busy || !sameWallet || !ready}
            onClick={() => { void act('send'); }}>在钱包中确认领取</button>}
          {recoverable && <><label>已有交易哈希 <input aria-label="已有原曲交易哈希" type="text" value={enteredHash}
            onChange={event => setHashInput({ scope, value: event.target.value })} disabled={busy} autoComplete="off" spellCheck={false} /></label>
            <button className="material-collect" type="button" disabled={busy || !sameWallet || (enteredHash.trim() ? !validHash : !cachedHash)}
              onClick={() => { void act('recover'); }}>登记已有交易哈希</button>
            <p>哈希只是查账线索，需链上核对后才会确认领取；此操作不会再次发送交易。</p></>}
          {!sameWallet && (canSendMaterialOrder(order) || recoverable) && <p>请连接此订单的接收钱包后继续。</p>}
          {order.status === 'success' && <p>这是历史领取记录；转出不恢复领取资格，当前持有数量以链上余额为准。</p>}
          {order.status === 'success' && asset && <Link href={asset}>打开原曲 →</Link>}
        </>}
        <p><button className="material-collect" type="button" disabled={busy} onClick={() => { void act('refresh'); }}>
          {busy ? '正在处理…' : '刷新状态'}</button></p>
      </section>}
    {auth.authenticated && notice?.scope === scope && <p className="material-error" role="alert">{notice.text}</p>}
  </Container>;
}
