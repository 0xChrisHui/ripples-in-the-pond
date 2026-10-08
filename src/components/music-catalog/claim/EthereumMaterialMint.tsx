'use client';
import { useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import type { OriginalTrack } from '../../../lib/music-catalog/types';
import { describeMaterialError, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import MaterialNoticeView from './MaterialNoticeView';
import MaterialOrderView from './MaterialOrderView';

export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const auth = useAuth(), { prepareOrder } = useMaterialMint();
  const [busy, setBusy] = useState(false), [error, setError] = useState<MaterialNotice | null>(null);
  const [orderId, setOrderId] = useState<Hex | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const deployment = getOriginalDeployment(track.trackId, 1);
  const deployed = deployment?.status === 'ready' && Boolean(deployment.contractAddress && deployment.metadataUri);
  const external = auth.walletCapability.walletKind === 'external' && Boolean(auth.selectedExternalWallet);
  async function collect() {
    if (!deployed || !external || busy) return;
    setBusy(true); setError(null);
    try {
      const order = await prepareOrder(track.trackId);
      if (active.current) setOrderId(order.orderId);
    } catch (caught) {
      if (active.current) setError(describeMaterialError(caught, '原曲订单暂不可用，请查询已有订单。'));
    } finally { if (active.current) setBusy(false); }
  }
  return <section className="material-chain-row" aria-label="Ethereum 原曲领取">
    <div className="material-chain-info"><h3>Ethereum</h3>
      <p className="material-muted">可转让 NFT · 由你的钱包支付 Gas</p>
      {!orderId && auth.authenticated && <details className="material-proof-details"><summary>接收地址</summary>
        <p className="material-uri">{auth.selectedExternalWallet?.address ?? '请使用已关联的链上地址登录'}</p></details>}
    </div>
    <div className="material-chain-action">
    {!deployed ? <><p className="material-muted">合约尚未部署，当前未开放收藏。</p>
      <button className="material-collect" type="button" disabled>Ethereum 原曲暂未开放</button></>
      : !auth.authenticated ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后收藏</button>
        : !orderId && <button className="material-collect" type="button" disabled={!external || busy} onClick={() => { void collect(); }}>
          {busy ? '正在查询并创建订单…' : '领取 Ethereum 原曲'}</button>}
    </div>
    {error && <div className="material-chain-status"><MaterialNoticeView notice={error} /></div>}
    {orderId && <div className="material-chain-status"><MaterialOrderView orderId={orderId} embedded /></div>}
  </section>;
}
