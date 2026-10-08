'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWithAuth } from '../../../lib/fetch-with-auth';
import type { OriginalTrack } from '../../../lib/music-catalog/types';
import { getOriginalMintDeployment } from '../../../lib/music-catalog/asset-registry';
import EthereumMaterialMint from './EthereumMaterialMint';
import MaterialNoticeView from './MaterialNoticeView';
type MintStatus = { status?: string | null; txHash?: string | null; recipientAddress?: string; recipientFrozen?: boolean;
  error?: string; code?: string; needsReview?: boolean; alreadyMinted?: boolean };
export default function MaterialMintPanel({ track }: { track: OriginalTrack }) {
  const auth = useAuth();
  // 两链独立保留领取状态；换身份或曲目只重建领取内容，不重建音乐圆圈。
  const scope = JSON.stringify([auth.authSource, auth.userId, auth.evmAddress?.toLowerCase(), track.trackId]);
  return <section className="material-mint" id="track-collect" aria-label="收藏原曲">
    <h2>收藏原曲</h2>
    <details className="material-rules"><summary>领取规则</summary><ul>
      <li>每个钱包对同一首原曲累计只能领取一次，转出后不恢复领取资格。</li>
      <li>每首总量不设上限；领取本身不收费。</li>
      <li>Optimism 为不可转让的 SBT，Gas 由平台支付；Ethereum 为可转让的 NFT，需用你关联的外部钱包支付 Gas。</li>
    </ul></details>
    <OpMaterialMint key={`op:${scope}`} track={track} auth={auth} />
    <EthereumMaterialMint key={`eth:${scope}`} track={track} />
  </section>;
}

function OpMaterialMint({ track, auth }: { track: OriginalTrack; auth: ReturnType<typeof useAuth> }) {
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
        if (!cancelled) setStatus(body);
      } catch { if (!cancelled) setStatus({ error: '收藏状态暂不可用，请稍后查询。' }); }
    })();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken, track.trackId, opAvailable]);
  async function collect() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await auth.getAccessToken();
      if (!active.current) return;
      if (!token) { auth.openLoginModal(); return; }
      const response = await fetchWithAuth('/api/material-mint/op', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: track.trackId }) });
      const result = await response.json() as MintStatus;
      if (active.current) setStatus(result);
    } catch {
      if (active.current) setStatus({ error: '请求结果暂不可用，请查询收藏状态后再操作。', needsReview: true });
    } finally { if (active.current) setBusy(false); }
  }
  const pending = status?.needsReview || ['pending', 'minting_onchain'].includes(status?.status ?? '');
  return <section className="material-chain-row" aria-label="Optimism 原曲领取">
    <div className="material-chain-info"><h3>Optimism</h3>
      <p className="material-muted">不可转让 SBT · 平台承担 Gas</p>
      {status?.recipientAddress && <details className="material-proof-details"><summary>接收地址</summary>
        <p className="material-uri">{status.recipientAddress}</p></details>}
    </div>
    <div className="material-chain-action">
        {!opAvailable ? <button type="button" className="material-collect" disabled>Optimism 原曲暂未开放</button>
          : !auth.authenticated ? <button type="button" className="material-collect" onClick={auth.openLoginModal}>登录后收藏</button>
          : <button type="button" className="material-collect" disabled={busy || Boolean(pending) || status?.alreadyMinted || status?.status === 'success'
            || status?.code?.startsWith('OP_SBT_') || status?.code === 'OP_SNAPSHOT_PENDING' || !status?.recipientAddress}
            onClick={() => { void collect(); }}>{busy ? '正在提交…' : status?.status === 'success' || status?.alreadyMinted ? '已有收藏记录'
              : pending ? '等待链上确认 / 核对' : '领取 Optimism 原曲'}</button>}
    </div>
    <div className="material-mint-status material-chain-status" aria-live="polite">
      {status?.error && <MaterialNoticeView notice={{ tone: 'warn', title: status.error,
        hint: status.needsReview ? '请到“我的”查看已有记录，确认后再操作。' : undefined }} />}
      {status?.status === 'success' && <p>历史收藏已确认；当前持有情况以链上余额为准。</p>}
      {pending && <p>请求已受理，尚未确认铸造完成。请到“我的”查看已有记录。</p>}
      {status?.txHash && <p className="material-uri">交易：{status.txHash}</p>}
    </div>
  </section>;
}
