'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchWithAuth } from '../../lib/fetch-with-auth';
import type { OriginalTrack } from '../../lib/music-catalog/types';
import { getOriginalMintDeployment } from '../../lib/music-catalog/asset-registry';
import EthereumMaterialMint from './EthereumMaterialMint';
type MintStatus = { status?: string | null; txHash?: string | null; recipientAddress?: string; recipientFrozen?: boolean;
  error?: string; code?: string; needsReview?: boolean; alreadyMinted?: boolean };
export default function MaterialMintPanel({ track }: { track: OriginalTrack }) {
  const auth = useAuth();
  const { authenticated, getAccessToken } = auth;
  const [network, setNetwork] = useState<10 | 1>(10);
  const [status, setStatus] = useState<MintStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const opAvailable = getOriginalMintDeployment(track.trackId, 10)?.status === 'ready';
  useEffect(() => {
    if (!authenticated || !opAvailable) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetchWithAuth(`/api/material-mint/op/status?trackId=${encodeURIComponent(track.trackId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json() as MintStatus;
        if (!cancelled) setStatus(body);
      } catch { if (!cancelled) setStatus({ error: '收藏状态暂不可用，请稍后查询。' }); }
    })();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken, track.trackId, opAvailable]);
  async function collect() {
    setBusy(true);
    try {
      const token = await auth.getAccessToken();
      if (!token) { auth.openLoginModal(); return; }
      const response = await fetchWithAuth('/api/material-mint/op', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId: track.trackId }) });
      const result = await response.json() as MintStatus;
      setStatus(result);
    } catch { setStatus({ error: '请求结果暂不可用，请查询收藏状态后再操作。', needsReview: true }); }
    finally { setBusy(false); }
  }
  const pending = status?.needsReview || ['pending', 'minting_onchain'].includes(status?.status ?? '');
  return <section className="material-mint" aria-label="收藏原曲">
    <h3>收藏原曲</h3>
    <div className="material-network-choice" role="group" aria-label="收藏网络">
      <button type="button" aria-pressed={network === 10} onClick={() => setNetwork(10)}>Optimism</button>
      <button type="button" aria-pressed={network === 1} onClick={() => setNetwork(1)}>Ethereum</button>
    </div>
    {network === 1 ? <EthereumMaterialMint track={track} />
      : <><p className="material-muted">新 OP 原曲为不可转让的 SBT，平台支付 Gas；尚未部署，当前未开放收藏。旧版藏品与收藏记录保留。</p>
        {status?.recipientAddress && <p className="material-uri">接收地址：{status.recipientAddress}</p>}
        {!opAvailable ? <button type="button" className="material-collect" disabled>OP 原曲 SBT 尚未开放</button>
          : !auth.authenticated ? <button type="button" className="material-collect" onClick={auth.openLoginModal}>登录后收藏</button>
          : <button type="button" className="material-collect" disabled={busy || Boolean(pending) || status?.alreadyMinted || status?.status === 'success'
            || status?.code?.startsWith('OP_SBT_') || status?.code === 'OP_SNAPSHOT_PENDING' || !status?.recipientAddress}
            onClick={() => { void collect(); }}>{busy ? '正在提交…' : status?.status === 'success' || status?.alreadyMinted ? '已有收藏记录'
              : pending ? '等待链上确认 / 核对' : '收藏这首原曲'}</button>}
      </>}
    {network === 10 && <div className="material-mint-status" aria-live="polite">
      {status?.error && <p>{status.error}</p>}
      {status?.status === 'success' && <p>历史收藏已确认；当前持有情况以链上余额为准。</p>}
      {pending && <p>请求已受理，尚未确认铸造完成。请到“我的”查看已有记录。</p>}
      {status?.txHash && <p className="material-uri">交易：{status.txHash}</p>}
    </div>}
  </section>;
}
