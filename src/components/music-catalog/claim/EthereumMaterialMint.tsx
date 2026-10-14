'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Hex } from 'viem';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { canSendMaterialOrder, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { announceMintRecorded } from '../../../lib/mint-notice';
import { waitUntil } from '../../../features/material-catalog/mint/wait-until';
import { getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import type { OriginalTrack } from '../../../lib/music-catalog/types';
import { describeMaterialError, useMaterialErrorCopy, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import MaterialNoticeView from './MaterialNoticeView';
import MaterialOrderView from './MaterialOrderView';

const BUSY_KEYS = { wallet: 'busyWallet', order: 'busyOrder', sign: 'busySign' } as const;

/** 一步铸造：点击后依次等待钱包就绪、建单（或复用已有订单）、直接弹出钱包签名。 */
export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const t = useTranslations('material'), copy = useMaterialErrorCopy();
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
      // 本地文案直接成提示（与原“短中文原文作标题”同形），英文模式也能看到具体原因
      if (!await waitUntil(ready, 25000)) {
        if (active.current) setNotice({ tone: 'error', title: t('eth.walletNotReady'), hint: copy.reviewHint });
        return;
      }
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
      if (active.current) setNotice(describeMaterialError(caught, copy, t('eth.orderUnavailable')));
    } finally { if (active.current) { setBusy(null); setRefresh((value) => value + 1); } }
  }
  const finished = order && !canSendMaterialOrder(order);
  return <section className="material-chain-row" aria-label={t('eth.label')}>
    <div className="material-chain-info"><h3>Ethereum</h3>
      <p className="material-muted">{t('eth.kind')}</p>
      {!order && <details className="material-proof-details"><summary>{t('recipient')}</summary>
        <p className="material-uri">{auth.selectedExternalWallet?.address ?? t('eth.signInWithWallet')}</p></details>}
    </div>
    <div className="material-chain-action">
      {!deployed ? <><p className="material-muted">{t('eth.undeployed')}</p>
        <button className="material-collect" type="button" disabled>{t('eth.unavailable')}</button></>
        : !finished && <button className="material-collect" type="button" disabled={Boolean(busy)} onClick={() => { void collect(); }}>
          {busy ? t(`eth.${BUSY_KEYS[busy]}`) : t('eth.mint')}</button>}
    </div>
    {notice && <div className="material-chain-status"><MaterialNoticeView notice={notice} /></div>}
    {order && <div className="material-chain-status"><MaterialOrderView key={`${order.orderId}:${refresh}`} orderId={order.orderId as Hex} embedded /></div>}
  </section>;
}
