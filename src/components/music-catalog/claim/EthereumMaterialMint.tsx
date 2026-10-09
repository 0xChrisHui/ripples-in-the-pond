'use client';
import { useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { canSendMaterialOrder, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { announceMintRecorded } from '../../../lib/mint-notice';
import { waitUntil } from '../../../features/material-catalog/mint/wait-until';
import { getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import type { OriginalTrack } from '../../../lib/music-catalog/types';
import { describeMaterialError, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import MaterialNoticeView from './MaterialNoticeView';
import MaterialOrderView from './MaterialOrderView';

/** 一步铸造：点击后依次等待钱包就绪、建单（或复用已有订单）、直接弹出钱包签名。 */
export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const auth = useAuth(), mint = useMaterialMint();
  const latest = useRef({ auth, mint });
  useEffect(() => { latest.current = { auth, mint }; });
  const [busy, setBusy] = useState<'wallet' | 'order' | 'sign' | null>(null), [notice, setNotice] = useState<MaterialNotice | null>(null);
  const [order, setOrder] = useState<PublicMaterialOrder | null>(null), [refresh, setRefresh] = useState(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const deployment = getOriginalDeployment(track.trackId, 1);
  const deployed = deployment?.status === 'ready' && Boolean(deployment.contractAddress && deployment.metadataUri);
  const ready = () => latest.current.auth.walletCapability.walletKind === 'external' && Boolean(latest.current.auth.selectedExternalWallet);
  const external = auth.walletCapability.walletKind === 'external' && Boolean(auth.selectedExternalWallet);
  // 钱包就绪后读取本人在这首上的已有订单，让“已铸造/进行中”状态直接可见。
  useEffect(() => {
    if (!deployed || !external) return;
    let cancelled = false;
    void mint.listOrders(track.trackId).then((orders) => {
      const existing = orders.find((item) => item.chainId === 1 && item.tokenId === deployment?.tokenId
        && item.recipientAddress === auth.selectedExternalWallet?.address && item.status !== 'cancelled');
      if (!cancelled && existing) setOrder(existing);
    }).catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployed, external, track.trackId]);
  async function collect() {
    if (!deployed || busy) return;
    setNotice(null); setBusy('wallet');
    try {
      if (!await waitUntil(ready, 25000)) throw Error('钱包还没有准备好，请确认钱包已连接后再点一次');
      if (!active.current) return;
      setBusy('order');
      let current = await latest.current.mint.prepareOrder(track.trackId);
      if (active.current) setOrder(current);
      if (canSendMaterialOrder(current)) {
        setBusy('sign');
        try { await latest.current.mint.sendOrder(current.orderId as Hex); announceMintRecorded(); }
        finally { current = await latest.current.mint.getOrder(current.orderId as Hex).catch(() => current); }
        if (active.current) setOrder(current);
      }
    } catch (caught) {
      if (active.current) setNotice(describeMaterialError(caught, '原曲订单暂不可用，请查询已有订单。'));
    } finally { if (active.current) { setBusy(null); setRefresh((value) => value + 1); } }
  }
  const finished = order && !canSendMaterialOrder(order);
  const labels = { wallet: '正在准备钱包…', order: '正在创建订单…', sign: '请在钱包中确认…' } as const;
  return <section className="material-chain-row" aria-label="Ethereum 原曲铸造">
    <div className="material-chain-info"><h3>Ethereum</h3>
      <p className="material-muted">可转让 NFT · 由你的钱包支付 Gas</p>
      {!order && <details className="material-proof-details"><summary>接收地址</summary>
        <p className="material-uri">{auth.selectedExternalWallet?.address ?? '请使用已关联的链上地址登录'}</p></details>}
    </div>
    <div className="material-chain-action">
      {!deployed ? <><p className="material-muted">合约尚未部署，当前未开放收藏。</p>
        <button className="material-collect" type="button" disabled>Ethereum 原曲暂未开放</button></>
        : !finished && <button className="material-collect" type="button" disabled={Boolean(busy)} onClick={() => { void collect(); }}>
          {busy ? labels[busy] : '铸造 Ethereum 原曲'}</button>}
    </div>
    {notice && <div className="material-chain-status"><MaterialNoticeView notice={notice} /></div>}
    {order && <div className="material-chain-status"><MaterialOrderView key={`${order.orderId}:${refresh}`} orderId={order.orderId as Hex} embedded /></div>}
  </section>;
}
