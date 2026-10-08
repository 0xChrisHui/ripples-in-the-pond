'use client';
import Link from 'next/link';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import PageNavigation from '../../pond-shell/navigation/PageNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress, type Hex } from 'viem';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { MATERIAL_STATUS_COPY, canSendMaterialOrder, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { describeMaterialError, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import { formatEth, readGasHint, type GasHint } from '../../../features/material-catalog/mint/gas-hint';
import MaterialNoticeView from './MaterialNoticeView';
import { readMaterialHash } from '../../../features/material-catalog/mint/attempt-cache';
import { getMusicCatalog, getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../../lib/chain/multichain/registry';

const STEPS = ['订单已创建', '钱包确认', '链上确认'] as const;
/** 当前进行到第几步（0 起）；success 之后三步全部完成。 */
function stepIndex(status: PublicMaterialOrder['status']) {
  if (status === 'success') return 3;
  if (['sending', 'unknown', 'submitted', 'confirming'].includes(status)) return 2;
  return 1;
}

export default function MaterialOrderView({ orderId, embedded = false }: { orderId: Hex; embedded?: boolean }) {
  const auth = useAuth(), { getOrder, sendOrder, recoverOrder } = useMaterialMint();
  const owner = auth.userId, scope = `${owner}:${orderId}`, activeScope = useRef(scope); activeScope.current = scope;
  const [loaded, setLoaded] = useState<{ owner: string; order: PublicMaterialOrder } | null>(null);
  const [notice, setNotice] = useState<{ scope: string; notice: MaterialNotice } | null>(null);
  const [busy, setBusy] = useState(false), [cachedHash, setCachedHash] = useState<Hex | null>(null);
  const [hashInput, setHashInput] = useState<{ scope: string; value: string } | null>(null);
  const [gas, setGas] = useState<{ key: string; hint: GasHint | null } | null>(null);
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
      notice: describeMaterialError(error, '原曲订单暂不可用') }); });
    return () => { active = false; };
  }, [auth.authenticated, load, scope]);
  async function act(action: 'send' | 'recover' | 'refresh') {
    if (busy) return; setBusy(true); setNotice(null);
    try {
      if (action === 'send') await sendOrder(orderId);
      if (action === 'recover') await recoverOrder(orderId, enteredHash.trim() ? enteredHash.trim().toLowerCase() as Hex : undefined);
      await load();
    } catch (caught) {
      if (activeScope.current === scope) setNotice({ scope, notice: describeMaterialError(caught, '请求暂不可用，请查询已有订单') });
      // 钱包拒绝/失败后订单状态已变化；静默刷新让按钮与步骤同步，同时保留上面的提示。
      if (action === 'send') await load().then(() => { if (activeScope.current === scope) setNotice({ scope,
        notice: describeMaterialError(caught, '请求暂不可用，请查询已有订单') }); }).catch(() => undefined);
    }
    finally { setBusy(false); }
  }
  const deployment = order && getOriginalDeployment(order.trackId, order.chainId);
  const sameWallet = order && auth.walletCapability.walletKind === 'external' && auth.selectedExternalWallet
    && getAddress(auth.selectedExternalWallet.address) === order.recipientAddress;
  const ready = deployment?.status === 'ready' && deployment.contractAddress?.toLowerCase() === order?.contractAddress.toLowerCase();
  const recoverable = order && order.digest && ['sending', 'unknown', 'submitted', 'confirming'].includes(order.status);
  const validHash = /^0x[0-9a-f]{64}$/i.test(enteredHash.trim()) && !/^0x0+$/i.test(enteredHash.trim());
  const asset = ready && deployment?.tokenId === order?.tokenId ? deployment.publicPlaybackUrl : null;
  const sendable = Boolean(order && canSendMaterialOrder(order) && !cachedHash && sameWallet);
  const wallet = auth.selectedExternalWallet, gasKey = order ? `${order.orderId}:${order.version}` : '';
  useEffect(() => {
    if (!order || !sendable || !wallet) return;
    let active = true;
    void wallet.getEthereumProvider().then(provider => readGasHint(provider, getAddress(wallet.address), order.chainId))
      .then(hint => { if (active) setGas({ key: gasKey, hint }); }).catch(() => { if (active) setGas({ key: gasKey, hint: null }); });
    return () => { active = false; };
  }, [order, sendable, wallet, gasKey]);
  const gasHint = gas?.key === gasKey ? gas.hint : null;
  const Container = embedded ? 'section' : 'main', Heading = embedded ? 'h4' : 'h2';
  const finished = order && ['success', 'cancelled'].includes(order.status);
  const current = order ? stepIndex(order.status) : 0;
  return <Container className={embedded ? 'material-inline-claim' : 'material-catalog'} data-material-claim-inline={embedded || undefined}>
    {!embedded && <><PageNavigation />
      <nav className="material-header" aria-label="返回我的音乐"><PondRouteLink href="/me">← 我的音乐</PondRouteLink></nav>
      <div className="material-intro"><h1>原曲领取状态</h1><p>已有交易只查询或恢复，不重复发送。</p></div></>}
    {!auth.ready ? <p role="status">正在确认登录状态…</p> : !auth.authenticated
      ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后查看本人订单</button>
      : <section className="material-mint" aria-live="polite">
        {!order ? <p>正在读取本人订单…</p> : <>
          <Heading className="material-order-title">{MATERIAL_STATUS_COPY[order.status]}</Heading>
          <p className="material-muted">{getChainDefinition(order.chainId).displayName} · 原曲 Token #{order.tokenId} · 数量 1 · 领取免费，仅需支付 Gas</p>
          {order.status !== 'cancelled' && <ol className="material-steps" aria-label="领取进度">
            {STEPS.map((label, index) => <li key={label} data-state={index < current ? 'done' : index === current ? 'current' : 'todo'}
              aria-current={index === current ? 'step' : undefined}><span aria-hidden="true">{index < current ? '✓' : index + 1}</span>{label}</li>)}
          </ol>}
          {sendable && gasHint && <p className="material-gas" data-low={!gasHint.enough || undefined}>
            预计 Gas 约 {formatEth(gasHint.fee)} ETH · 钱包余额 {formatEth(gasHint.balance)} ETH
            {!gasHint.enough && ' · 余额偏低，可能无法完成，请先充入少量 ETH'}</p>}
          {canSendMaterialOrder(order) && !cachedHash && <button className="material-collect" type="button"
            disabled={busy || !sameWallet || !ready || gasHint?.enough === false}
            onClick={() => { void act('send'); }}>{busy ? '等待钱包确认…' : '在钱包中确认领取'}</button>}
          {recoverable && <details className="material-proof-details"><summary>已在钱包里确认，但这里没有更新？</summary><label>已有交易哈希 <input aria-label="已有原曲交易哈希" type="text" value={enteredHash}
            onChange={event => setHashInput({ scope, value: event.target.value })} disabled={busy} autoComplete="off" spellCheck={false} /></label>
            <button className="material-collect" type="button" disabled={busy || !sameWallet || (enteredHash.trim() ? !validHash : !cachedHash)}
              onClick={() => { void act('recover'); }}>登记已有交易哈希</button>
            <p className="material-muted">哈希只是查账线索，需链上核对后才会确认领取；此操作不会再次发送交易。</p></details>}
          {!sameWallet && (canSendMaterialOrder(order) || recoverable) && <p className="material-muted">请连接此订单的接收钱包后继续。</p>}
          {order.status === 'sending' && !cachedHash && <p className="material-muted">正在等待钱包响应。若已拒绝或关闭了钱包弹窗，稍后点“刷新状态”即可重新领取。</p>}
          {order.status === 'success' && <p className="material-muted">这是历史领取记录；转出不恢复领取资格，当前持有数量以链上余额为准。</p>}
          {order.status === 'success' && asset && <Link href={asset}>打开原曲 →</Link>}
          {order.txHash && <p className="material-muted"><a href={explorerTxUrlFor(order.chainId, order.txHash)} target="_blank" rel="noreferrer">在区块浏览器查看交易 ↗</a></p>}
          <details className="material-proof-details"><summary>订单详情</summary>
            <p className="material-uri">接收地址：{order.recipientAddress}</p>
            <p className="material-uri">合约：<a href={explorerAddressUrlFor(order.chainId, order.contractAddress)} target="_blank" rel="noreferrer">{order.contractAddress}</a></p>
            {order.txHash && <p className="material-uri">交易：{order.txHash}</p>}
          </details>
        </>}
        {!finished && <p><button className="material-refresh" type="button" disabled={busy} onClick={() => { void act('refresh'); }}>
          {busy ? '正在处理…' : '刷新状态'}</button></p>}
      </section>}
    {auth.authenticated && notice?.scope === scope && <MaterialNoticeView notice={notice.notice} />}
  </Container>;
}
