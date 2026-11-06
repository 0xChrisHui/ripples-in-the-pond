'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWithAuth } from '../../../lib/fetch-with-auth';
import { getOriginalDeployment, getOriginalMintDeployment, listReadyOriginals } from '../../../lib/music-catalog/asset-registry';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { clearMintCache, ethCache, opCache, type MintStatus } from './mint-status-cache';

const CONCURRENCY = 4;

/**
 * 登录后在后台预取所有已上链原曲的铸造状态（OP 收藏记录、以太坊已有订单），写入缓存。
 * 悬停 /lens 面板时直接读缓存，不再现场检索；无界面，挂在全局 Providers。
 */
export default function MintStatusPrefetch() {
  const auth = useAuth();
  const { listOrders } = useMaterialMint();
  // 回调每次渲染都会变；用 ref 取最新值，避免预取反复重启。
  const latest = useRef({ auth, listOrders });
  useEffect(() => { latest.current = { auth, listOrders }; });
  const { ready, authenticated, userId, walletCapability, selectedExternalWallet } = auth;
  const wallet = walletCapability.walletKind === 'external' ? selectedExternalWallet?.address ?? null : null;
  const identity = authenticated && userId ? `${userId}|${wallet ?? ''}` : null;

  useEffect(() => {
    if (!ready) return;
    if (!identity || !userId) { clearMintCache(); return; }
    let cancelled = false;
    const tracks = [...new Set(listReadyOriginals().map(({ track }) => track.trackId))];
    const work = tracks.flatMap((trackId) => {
      const jobs: Array<() => Promise<void>> = [];
      if (getOriginalMintDeployment(trackId, 10)?.status === 'ready') jobs.push(() => prefetchOp(trackId));
      const eth = getOriginalDeployment(trackId, 1);
      if (wallet && eth?.status === 'ready' && eth.contractAddress && eth.metadataUri) jobs.push(() => prefetchEth(trackId));
      return jobs;
    });

    async function prefetchOp(trackId: string) {
      const token = await latest.current.auth.getAccessToken();
      if (!token || cancelled) return;
      const response = await fetchWithAuth(`/api/material-mint/op/status?trackId=${encodeURIComponent(trackId)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok || cancelled) return;
      opCache.set(userId!, trackId, await response.json() as MintStatus);
    }
    async function prefetchEth(trackId: string) {
      const tokenId = getOriginalDeployment(trackId, 1)?.tokenId;
      const orders = await latest.current.listOrders(trackId);
      if (cancelled) return;
      // 与 EthereumMaterialMint 的匹配条件保持一致，缓存结果才能直接复用。
      const existing = orders.find((item) => item.chainId === 1 && item.tokenId === tokenId
        && item.recipientAddress === wallet && item.status !== 'cancelled') ?? null;
      ethCache.set(wallet!, trackId, existing);
    }

    // 并发池：最多 CONCURRENCY 个请求同时进行，单个失败不影响其余。
    let next = 0;
    const lane = async () => {
      while (!cancelled && next < work.length) {
        const job = work[next++];
        await job().catch(() => undefined);
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, lane));
    return () => { cancelled = true; };
  }, [ready, identity, userId, wallet]);

  return null;
}
