'use client';
import { useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { useAuth } from '../../hooks/useAuth';
import { useMaterialMint } from '../../features/material-catalog/mint/useMaterialMint';
import { getOriginalDeployment } from '../../lib/music-catalog/asset-registry';
import type { OriginalTrack } from '../../lib/music-catalog/types';
import MaterialOrderView from './MaterialOrderView';

export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const auth = useAuth(), { prepareOrder } = useMaterialMint();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
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
      if (active.current) setError(caught instanceof Error ? caught.message : '原曲订单暂不可用，请查询已有订单。');
    } finally { if (active.current) setBusy(false); }
  }
  return <section className="material-chain-row" aria-label="Ethereum 原曲领取">
    <div className="material-chain-info"><h4>Ethereum</h4>
      <p className="material-muted">原曲 NFT · 可转让 · 关联外部钱包支付 Gas</p>
      <p className="material-muted">每钱包每首累计领取一次，转出不恢复资格，每首总量无上限。</p>
      {!orderId && auth.authenticated && <details className="material-proof-details"><summary>接收地址</summary>
        <p className="material-uri">{auth.selectedExternalWallet?.address ?? '请使用已关联的链上地址登录'}</p></details>}
    </div>
    <div className="material-chain-action">
    {!deployed ? <><p className="material-muted">合约尚未部署，当前未开放收藏。</p>
      <button className="material-collect" type="button" disabled>Ethereum 原曲尚未开放</button></>
      : !auth.authenticated ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后收藏</button>
        : !orderId && <button className="material-collect" type="button" disabled={!external || busy} onClick={() => { void collect(); }}>
          {busy ? '正在查询并创建订单…' : '领取 ETH 原曲'}</button>}
    </div>
    {error && <p className="material-error material-chain-status" role="alert">{error}</p>}
    {orderId && <div className="material-chain-status"><MaterialOrderView orderId={orderId} embedded /></div>}
  </section>;
}
