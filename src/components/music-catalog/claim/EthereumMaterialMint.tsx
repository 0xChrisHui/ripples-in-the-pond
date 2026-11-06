'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import { ethCache, isFinishedOrder, loadMintStatus, mintCacheVersion, subscribeMintCache } from './mint-status-cache';
import { mintIdentityOf } from './MintStatusPrefetch';

const BUSY_KEYS = { wallet: 'busyWallet', order: 'busyOrder', sign: 'busySign' } as const;

/** 一步铸造：点击后依次等待钱包就绪、建单（或复用已有订单）、直接弹出钱包签名。 */
export default function EthereumMaterialMint({ track }: { track: OriginalTrack }) {
  const t = useTranslations('material');
  const auth = useAuth(), mint = useMaterialMint();
  const latest = useRef({ auth, mint });
  useEffect(() => { latest.current = { auth, mint }; });
  const [busy, setBusy] = useState<'wallet' | 'order' | 'sign' | null>(null), [notice, setNotice] = useState<MaterialNotice | null>(null);
  // picked：本次会话里铸造得到的订单；其余状态来自批量预取的缓存（未知时只禁用按钮）。
  const [picked, setPicked] = useState<PublicMaterialOrder | null>(null), [refresh, setRefresh] = useState(0);
  useSyncExternalStore(subscribeMintCache, mintCacheVersion, mintCacheVersion);
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
  const unknown = deployed && external && cached === undefined;
  const identity = mintIdentityOf(auth);
  const identityKey = identity ? `${identity.userId}|${identity.wallet ?? ''}` : '';
  // 兜底：正常情况下登录时已批量加载；缓存里仍没有时再请求一次（有冷却）。
  useEffect(() => {
    if (!unknown || !identity) return;
    void loadMintStatus(identity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unknown, identityKey]);
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
  const finished = isFinishedOrder(order);
  const stateName = !deployed ? 'undeployed' : unknown ? 'checking' : busy ? 'busy' : finished ? 'done' : 'idle';
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
        : <button className="material-collect" type="button" disabled={Boolean(busy) || unknown} onClick={() => { void collect(); }}>
          {busy ? t(`eth.${BUSY_KEYS[busy]}`) : t('eth.mint')}</button>}
    </div>
    {notice && <div className="material-chain-status"><MaterialNoticeView notice={notice} /></div>}
    {order && <div className="material-chain-status"><MaterialOrderView key={`${order.orderId}:${refresh}`} orderId={order.orderId as Hex} embedded /></div>}
  </section>;
}
