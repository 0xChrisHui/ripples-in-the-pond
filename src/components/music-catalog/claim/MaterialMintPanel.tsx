'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { announceMintRecorded } from '../../../lib/mint-notice';
import { waitUntil } from '../../../features/material-catalog/mint/wait-until';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWithAuth } from '../../../lib/fetch-with-auth';
import { useServerText } from '../../../i18n/use-server-text';
import type { OriginalTrack } from '../../../lib/music-catalog/types';
import { getOriginalMintDeployment } from '../../../lib/music-catalog/asset-registry';
import EthereumMaterialMint from './EthereumMaterialMint';
import { MaterialNoticeBox } from './MaterialNoticeView';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import { loadMintStatus, mintCacheVersion, opCache, subscribeMintCache, type MintStatus } from './mint-status-cache';
import { mintIdentityOf } from './MintStatusPrefetch';
/** compact：/lens 面板内的紧凑变体——不重复 id="track-collect"，不显示标题与规则折叠。 */
export default function MaterialMintPanel({ track, compact = false }: { track: OriginalTrack; compact?: boolean }) {
  const t = useTranslations('material');
  const auth = useAuth();
  const latest = useRef(auth);
  useEffect(() => { latest.current = auth; });
  // 两链独立保留铸造状态；换身份或曲目只重建铸造内容，不重建音乐圆圈。
  const scope = JSON.stringify([auth.authSource, auth.userId, auth.evmAddress?.toLowerCase(), track.trackId]);
  // 只有外部链上钱包登录才提供 Ethereum；邮箱/SEMI 等只见 Optimism。
  const external = auth.walletCapability.loginEntry === 'external_wallet';
  async function login() {
    // 登录状态可能还在初始化：先等就绪，已登录则无需再弹登录框。
    await waitUntil(() => latest.current.ready, 15000);
    if (!latest.current.authenticated) latest.current.openLoginModal();
  }
  return <section className="material-mint" id={compact ? undefined : 'track-collect'} aria-label={t('panelTitle')}>
    {!compact && <h2>{t('panelTitle')}</h2>}
    {!compact && <details className="material-rules"><summary>{t('rulesSummary')}</summary><ul>
      <li>{t('ruleHome')}</li>
      <li>{t('ruleEth')}</li>
      <li>{t('ruleOp')}</li>
    </ul></details>}
    {!auth.authenticated ? <button type="button" className="material-collect" onClick={() => { void login(); }}>{t('signInToCollect')}</button> : <>
      <OpMaterialMint key={`op:${scope}`} track={track} auth={auth} />
      {external && <EthereumMaterialMint key={`eth:${scope}`} track={track} />}</>}
  </section>;
}

function OpMaterialMint({ track, auth }: { track: OriginalTrack; auth: ReturnType<typeof useAuth> }) {
  const t = useTranslations('material'), serverText = useServerText();
  // 状态来自批量预取的缓存；缓存更新时自动重绘。没有缓存（未知）时只禁用按钮，不显示任何过程文字。
  useSyncExternalStore(subscribeMintCache, mintCacheVersion, mintCacheVersion);
  const cached = auth.userId ? opCache.get(auth.userId, track.trackId) : undefined;
  const [local, setLocal] = useState<MintStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const opDeployment = getOriginalMintDeployment(track.trackId, 10);
  const opAvailable = opDeployment?.status === 'ready';
  const pageUrl = opDeployment?.publicPlaybackUrl ?? null;
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const identity = mintIdentityOf(auth);
  const identityKey = identity ? `${identity.userId}|${identity.wallet ?? ''}` : '';
  const unknownNow = cached === undefined;
  // 兜底：正常情况下登录时已批量加载；若缓存里仍没有本曲目，再请求一次（有冷却，不会反复打服务端）。
  useEffect(() => {
    if (!opAvailable || !unknownNow || !identity) return;
    void loadMintStatus(identity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opAvailable, unknownNow, identityKey]);
  async function collect() {
    if (busy) return;
    setBusy(true);
    try {
      let token = await auth.getAccessToken();
      for (let i = 0; !token && i < 20 && active.current; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300)); token = await auth.getAccessToken();
      }
      if (!active.current) return;
      if (!token) { setLocal({ errorKey: 'notReady' }); return; }
      const response = await fetchWithAuth('/api/material-mint/op', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: track.trackId }) });
      const result = await response.json() as MintStatus;
      if (response.ok && !result.error) announceMintRecorded();
      if (active.current) {
        setLocal(result);
        if (auth.userId) opCache.set(auth.userId, track.trackId, result);
      }
    } catch {
      if (active.current) setLocal({ errorKey: 'resultUnknown', needsReview: true });
    } finally { if (active.current) setBusy(false); }
  }
  const status = local ?? cached ?? null; // null = 未知（尚未批量加载完成）
  const unknown = status === null;
  // 服务端地址（冻结快照）优先；未返回前先用缓存/当前钱包地址，避免等待请求。
  const recipient = status?.recipientAddress ?? auth.evmAddress;
  const pending = status?.needsReview || ['pending', 'minting_onchain'].includes(status?.status ?? '');
  const done = status?.status === 'success' || Boolean(status?.alreadyMinted);
  const errorText = status?.errorKey ? t(`op.errors.${status.errorKey}`)
    : status?.error ? serverText(status.error, t('op.errors.server')) : null;
  const stateName = !opAvailable ? 'unavailable' : unknown ? 'checking' : done ? 'done' : pending ? 'pending' : 'idle';
  return <section className="material-chain-row" aria-label={t('op.label')} data-chain="OP" data-state={stateName}>
    <div className="material-chain-info"><h3>Optimism</h3>
      <p className="material-muted">{t('op.kind')}</p>
      {recipient && <details className="material-proof-details"><summary>{t('recipient')}</summary>
        <p className="material-uri">{recipient}</p></details>}
    </div>
    <div className="material-chain-action">
        {!opAvailable ? <button type="button" className="material-collect" disabled>{t('op.unavailable')}</button>
          : done && pageUrl ? <PondRouteLink href={`${pageUrl}#track-collect`} className="material-collect">{t('op.viewCollection')}</PondRouteLink>
          : <button type="button" className="material-collect" disabled={busy || unknown || Boolean(pending) || done
            || status?.code?.startsWith('OP_SBT_') || status?.code === 'OP_SNAPSHOT_PENDING'}
            onClick={() => { void collect(); }}>{busy ? t('op.submitting') : done ? t('op.alreadyCollected')
              : pending ? t('op.pending') : t('op.mint')}</button>}
    </div>
    <div className="material-mint-status material-chain-status" aria-live="polite">
      {errorText && <MaterialNoticeBox notice={{ tone: 'warn', title: errorText,
        hint: status?.needsReview ? t('op.reviewHint') : undefined }} />}
      {status?.status === 'success' && <p>{t('op.successNote')}</p>}
      {pending && <p>{t('op.pendingNote')}</p>}
      {status?.txHash && <p className="material-uri">{t('tx', { hash: status.txHash })}</p>}
    </div>
  </section>;
}
