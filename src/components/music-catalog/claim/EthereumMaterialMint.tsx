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
import { describeMaterialError, localMaterialNotice, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import MaterialNoticeView from './MaterialNoticeView';
import MaterialOrderView from './MaterialOrderView';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import { ethCache } from './mint-status-cache';

const BUSY_KEYS = { wallet: 'busyWallet', order: 'busyOrder', sign: 'busySign' } as const;

/** 一步铸造：点击后依次等待钱包就绪、建单（或复用已有订单）、直接弹出钱包签名。 */
export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const t = useTranslations('material');
  const auth = useAuth(), mint = useMaterialMint();
  const latest = useRef({ auth, mint });
  useEffect(() => { latest.current = { auth, mint }; });
  const [busy, setBusy] = useState<'wallet' | 'order' | 'sign' | null>(null), [notice, setNotice] = useState<MaterialNotice | null>(null);
  // picked：本次会话里铸造或查询得到的订单；cached：预取缓存（首帧即可用）。
  const [picked, setPicked] = useState<PublicMaterialOrder | null>(null), [refresh, setRefresh] = useState(0);
  const [fetched, setFetched] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const deployment = getOriginalDeployment(track.trackId, 1);
  const deployed = deployment?.status === 'ready' && Boolean(deployment.contractAddress && deployment.metadataUri);
  const ready = () => latest.current.auth.walletCapability.walletKind === 'external' && Boolean(latest.current.auth.selectedExternalWallet);
  const external = auth.walletCapability.walletKind === 'external' && Boolean(auth.selectedExternalWallet);
  const address = external ? auth.selectedExternalWallet?.address ?? '' : '';
  const cached = address ? ethCache.get(address, track.trackId) : undefined;
  const order = picked ?? cached ?? null;
  const checking = deployed && external && cached === undefined && !fetched;
  // 钱包就绪后读取本人在这首上的已有订单（后台刷新，缓存命中时不挡界面）。
  useEffect(() => {
    if (!deployed || !external || !address) return;
    let cancelled = false;
    void mint.listOrders(track.trackId).then((orders) => {
      const existing = orders.find((item) => item.chainId === 1 && item.tokenId === deployment?.tokenId
        && item.recipientAddress === address && item.status !== 'cancelled') ?? null;
      ethCache.set(address, track.trackId, existing);
      if (!cancelled) { setPicked((prev) => prev ?? existing); setFetched(true); }
    }).catch(() => { if (!cancelled) setFetched(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployed, external, address, track.trackId]);
  async function collect() {
    if (!deployed || busy) return;
    setNotice(null); setBusy('wallet');
    try {
      // 本地原因只存词典键，渲染时按当前语言取词
      if (!await waitUntil(ready, 25000)) {
        if (active.current) setNotice(localMaterialNotice('eth.walletNotReady'));
        return;
      }
      if (!active.current) return;
      setBusy('order');
      let current = await latest.current.mint.prepareOrder(track.trackId);
      if (active.current) setPicked(current);
      if (canSendMaterialOrder(current)) {
        setBusy('sign');
        try { await latest.current.mint.sendOrder(current.orderId as Hex); announceMintRecorded(); }
        finally { current = await latest.current.mint.getOrder(current.orderId as Hex).catch(() => current); }
        if (active.current) setPicked(current);
      }
      if (address) ethCache.set(address, track.trackId, current);
    } catch (caught) {
      if (active.current) setNotice(describeMaterialError(caught, 'eth.orderUnavailable'));
    } finally { if (active.current) { setBusy(null); setRefresh((value) => value + 1); } }
  }
  const finished = Boolean(order && !canSendMaterialOrder(order));
  const stateName = !deployed ? 'undeployed' : checking ? 'checking' : busy ? 'busy' : finished ? 'done' : 'idle';
  return <section className="material-chain-row" aria-label={t('eth.label')} data-chain="ETH" data-state={stateName}>
    <div className="material-chain-info"><h3>Ethereum</h3>
      <p className="material-muted">{t('eth.kind')}</p>
      {!order && <details className="material-proof-details"><summary>{t('recipient')}</summary>
        <p className="material-uri">{auth.selectedExternalWallet?.address ?? t('eth.signInWithWallet')}</p></details>}
    </div>
    <div className="material-chain-action">
      {!deployed ? <><p className="material-muted">{t('eth.undeployed')}</p>
        <button className="material-collect" type="button" disabled>{t('eth.unavailable')}</button></>
        : finished && deployment?.publicPlaybackUrl ? <PondRouteLink href={`${deployment.publicPlaybackUrl}#track-collect`} className="material-collect">{t('eth.viewCollection')}</PondRouteLink>
        : finished ? <button className="material-collect" type="button" disabled>{t('op.alreadyCollected')}</button>
        : <button className="material-collect" type="button" disabled={Boolean(busy) || checking} onClick={() => { void collect(); }}>
          {busy ? t(`eth.${BUSY_KEYS[busy]}`) : checking ? t('eth.checking') : t('eth.mint')}</button>}
    </div>
    {notice && <div className="material-chain-status"><MaterialNoticeView notice={notice} /></div>}
    {order && <div className="material-chain-status"><MaterialOrderView key={`${order.orderId}:${refresh}`} orderId={order.orderId as Hex} embedded /></div>}
  </section>;
}
