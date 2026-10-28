'use client';
import { useEffect, useRef, useState } from 'react';
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
type OpErrorKey = 'statusUnavailable' | 'notReady' | 'resultUnknown';
/** error 为服务端原文（中文模式照旧显示）；errorKey 为本地文案 */
type MintStatus = { status?: string | null; txHash?: string | null; recipientAddress?: string; recipientFrozen?: boolean;
  error?: string; errorKey?: OpErrorKey; code?: string; needsReview?: boolean; alreadyMinted?: boolean };
export default function MaterialMintPanel({ track }: { track: OriginalTrack }) {
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
  return <section className="material-mint" id="track-collect" aria-label={t('panelTitle')}>
    <h2>{t('panelTitle')}</h2>
    <details className="material-rules"><summary>{t('rulesSummary')}</summary><ul>
      <li>{t('ruleHome')}</li>
      <li>{t('ruleEth')}</li>
      <li>{t('ruleOp')}</li>
    </ul></details>
    {!auth.authenticated ? <button type="button" className="material-collect" onClick={() => { void login(); }}>{t('signInToCollect')}</button> : <>
      <OpMaterialMint key={`op:${scope}`} track={track} auth={auth} />
      {external && <EthereumMaterialMint key={`eth:${scope}`} track={track} />}</>}
  </section>;
}

// 同一用户的接收地址跨曲目复用：切曲目重建组件时不必再等 op/status 才显示。
const recipientCache = new Map<string, string>();

function OpMaterialMint({ track, auth }: { track: OriginalTrack; auth: ReturnType<typeof useAuth> }) {
  const t = useTranslations('material'), serverText = useServerText();
  const { authenticated, getAccessToken } = auth;
  const [status, setStatus] = useState<MintStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const opAvailable = getOriginalMintDeployment(track.trackId, 10)?.status === 'ready';
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (!authenticated || !opAvailable) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const response = await fetchWithAuth(`/api/material-mint/op/status?trackId=${encodeURIComponent(track.trackId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json() as MintStatus;
        if (!cancelled) { setStatus(body); if (auth.userId && body.recipientAddress) recipientCache.set(auth.userId, body.recipientAddress); }
      } catch { if (!cancelled) setStatus({ errorKey: 'statusUnavailable' }); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, getAccessToken, track.trackId, opAvailable]);
  async function collect() {
    if (busy) return;
    setBusy(true);
    try {
      let token = await auth.getAccessToken();
      for (let i = 0; !token && i < 20 && active.current; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300)); token = await auth.getAccessToken();
      }
      if (!active.current) return;
      if (!token) { setStatus({ errorKey: 'notReady' }); return; }
      const response = await fetchWithAuth('/api/material-mint/op', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: track.trackId }) });
      const result = await response.json() as MintStatus;
      if (response.ok && !result.error) announceMintRecorded();
      if (active.current) setStatus(result);
    } catch {
      if (active.current) setStatus({ errorKey: 'resultUnknown', needsReview: true });
    } finally { if (active.current) setBusy(false); }
  }
  // 服务端地址（冻结快照）优先；未返回前先用缓存/当前钱包地址，避免等待请求。
  const recipient = status?.recipientAddress ?? (auth.userId ? recipientCache.get(auth.userId) : undefined) ?? auth.evmAddress;
  const pending = status?.needsReview || ['pending', 'minting_onchain'].includes(status?.status ?? '');
  const errorText = status?.errorKey ? t(`op.errors.${status.errorKey}`)
    : status?.error ? serverText(status.error, t('op.errors.server')) : null;
  return <section className="material-chain-row" aria-label={t('op.label')}>
    <div className="material-chain-info"><h3>Optimism</h3>
      <p className="material-muted">{t('op.kind')}</p>
      {recipient && <details className="material-proof-details"><summary>{t('recipient')}</summary>
        <p className="material-uri">{recipient}</p></details>}
    </div>
    <div className="material-chain-action">
        {!opAvailable ? <button type="button" className="material-collect" disabled>{t('op.unavailable')}</button>
          : <button type="button" className="material-collect" disabled={busy || Boolean(pending) || status?.alreadyMinted || status?.status === 'success'
            || status?.code?.startsWith('OP_SBT_') || status?.code === 'OP_SNAPSHOT_PENDING'}
            onClick={() => { void collect(); }}>{busy ? t('op.submitting') : status?.status === 'success' || status?.alreadyMinted ? t('op.alreadyCollected')
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
