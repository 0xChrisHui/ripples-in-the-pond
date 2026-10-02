'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMaterialMint } from '../../features/material-catalog/mint/useMaterialMint';
import { getOriginalDeployment } from '../../lib/music-catalog/asset-registry';
import type { OriginalTrack } from '../../lib/music-catalog/types';

export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const auth = useAuth(), { prepareOrder } = useMaterialMint(), router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const deployment = getOriginalDeployment(track.trackId, 1);
  const deployed = deployment?.status === 'ready' && Boolean(deployment.contractAddress && deployment.metadataUri);
  const external = auth.walletCapability.walletKind === 'external' && Boolean(auth.selectedExternalWallet);
  async function collect() {
    if (!deployed || !external || busy) return;
    setBusy(true); setError(null);
    try {
      const order = await prepareOrder(track.trackId);
      router.push(`/me/material/${order.orderId}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '原曲订单暂不可用，请查询已有订单。'); }
    finally { setBusy(false); }
  }
  return <div>
    <p className="material-muted">Ethereum 原曲可转让，由关联的外部钱包自付 Gas；每钱包每首累计领取一次，转出不恢复资格，每首总量无上限。</p>
    {!deployed ? <><p className="material-muted">合约尚未部署，当前未开放收藏。</p>
      <button className="material-collect" type="button" disabled>Ethereum 原曲尚未开放</button></>
      : !auth.authenticated ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>登录后收藏</button>
        : <><p className="material-uri">接收地址：{auth.selectedExternalWallet?.address ?? '请使用已关联的链上地址登录'}</p>
          <button className="material-collect" type="button" disabled={!external || busy} onClick={() => { void collect(); }}>
            {busy ? '正在查询并创建订单…' : '收藏这首原曲'}</button></>}
    {error && <p className="material-error" role="alert">{error}</p>}
    <p><Link href="/me/material">查看本人原曲订单 →</Link></p>
  </div>;
}
