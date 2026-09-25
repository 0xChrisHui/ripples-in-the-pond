'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import { useAuth } from '@/src/hooks/useAuth';
import { useEthereumScoreMint } from '@/src/hooks/useEthereumScoreMint';
import { forgetMintHash, readMintHash, recoverMintHash } from '@/src/lib/self-mint/client-hash';
import ReconnectMintWallet from './ReconnectMintWallet';
import { useMintDialogFocus } from './hooks/useMintDialogFocus';
import { useSerialRefresh } from './hooks/useSerialRefresh';
import { ASSET_STAGE_COPY, STATUS_COPY, type PublicOrder } from './self-mint-copy';
import './self-mint-status.css';

export default function SelfMintOrderView({ orderId, onClose }: {
  orderId: Hex; onClose: () => void;
}) {
  const auth = useAuth();
  const getAccessToken = auth.getAccessToken;
  const { prepareOrder, sendOrder } = useEthereumScoreMint();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [recoverableHash, setRecoverableHash] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const lastAssetKickRef = useRef(0);
  closeRef.current = onClose;
  busyRef.current = busy;
  const walletAddress = auth.selectedExternalWallet?.address ?? null;

  useEffect(() => { setRecoverableHash(readMintHash(orderId)); }, [orderId]);
  useMintDialogFocus(dialogRef, closeRef, busyRef);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('登录已失效');
    const query = walletAddress ? `?walletAddress=${encodeURIComponent(walletAddress)}` : '';
    const response = await fetch(`/api/self-mint/order/${orderId}${query}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const result = await response.json() as PublicOrder & { error?: string };
    if (!response.ok) throw new Error(result.error ?? '订单读取失败');
    setOrder(result);
    if (result.status === 'preparing_assets' && Date.now() - lastAssetKickRef.current >= 5_000) {
      lastAssetKickRef.current = Date.now();
      void fetch(`/api/self-mint/order/${orderId}/advance`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    if (!result.sendAttempted || result.status === 'submitted'
      || result.status === 'confirming' || result.status === 'success') {
      forgetMintHash(orderId);
    }
    setRecoverableHash(readMintHash(orderId));
    setLastCheckedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    setError((current) => result.status === 'manual_review' || result.sendAttempted ? current : null);
  }, [getAccessToken, orderId, walletAddress]);

  useSerialRefresh(load, busy, (caught) => {
    setError(caught instanceof Error ? caught.message : '订单读取失败');
  });

  async function send() {
    setBusy(true);
    setError(null);
    try { if (order) await sendOrder(orderId, order.chainId); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '钱包交易没有完成'); }
    finally { setRecoverableHash(readMintHash(orderId)); setBusy(false); }
  }

  async function recover() {
    if (!order?.authorizationDigest || !recoverableHash) return;
    setBusy(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('登录已失效');
      await recoverMintHash({ orderId, digest: order.authorizationDigest, txHash: recoverableHash,
        walletAddress: order.recipientAddress, accessToken });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '交易登记失败'); }
    finally { setBusy(false); }
  }

  async function release() {
    if (!walletAddress) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('登录已失效');
      const response = await fetch('/api/self-mint/release', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, walletAddress }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '暂不能重新选择');
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '暂不能重新选择');
      setBusy(false);
    }
  }

  const copy = order && (busy && order.status === 'ready_to_sign'
    ? { title: '正在打开 MetaMask', detail: '请在钱包窗口中检查并确认这笔 Sepolia 铸造交易。' }
    : order.status === 'preparing_assets'
    ? ASSET_STAGE_COPY[order.assetStage]
    : order.status === 'ready_to_sign' && order.sendAttempted
      ? STATUS_COPY.manual_review : STATUS_COPY[order.status]);
  const hash = order && (order.replacementTxHash ?? order.txHash ?? order.failedTxHash);
  const canSend = order && !order.sendAttempted && !recoverableHash
    && order.canContinue && auth.walletCapability.canSelfPayEthGas
    && (order.status === 'ready_to_sign' || order.status === 'expired');
  const needsWallet = order && (order.status === 'ready_to_sign' || order.status === 'expired'
    || (order.status === 'failed' && order.retryable));
  const assetHref = order && `/score/${order.chainId}/${order.scoreContract.toLowerCase()}/${order.tokenId}`;

  useEffect(() => {
    if (canSend) void prepareOrder(orderId).catch(() => undefined);
  }, [canSend, orderId, prepareOrder]);

  if (!order && !error) return null;

  return (
    <div className="self-mint-status" data-p11-theme="archive" data-status={order?.status}
      role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}>
      <section ref={dialogRef} tabIndex={-1} className="self-mint-status__sheet" role="dialog"
        aria-modal="true" aria-labelledby="self-mint-title">
        <header>
          <span>SELF-PAID SCORE · {order ? getChainDefinition(order.chainId).displayName : 'Ethereum'}</span>
          <button type="button" className="self-mint-status__close" aria-label="关闭铸造弹窗"
            disabled={busy} onClick={onClose}>×</button>
        </header>
        {!order ? <><h2 id="self-mint-title">铸造进度</h2>
          <p className="self-mint-status__loading" role="status">{error ?? '正在读取铸造档案…'}</p>
          {error && <div className="self-mint-status__actions"><button type="button"
            onClick={() => void load()}>重新读取</button></div>}
        </> : <>
        <p className="self-mint-status__eyebrow">Reserved edition · 未铸造编号 #{order.tokenId}</p>
        <h2 id="self-mint-title">{copy?.title}</h2>
        <p className="self-mint-status__lead" aria-live="polite">{copy?.detail}</p>
        <dl>
          <div><dt>网络</dt><dd>{getChainDefinition(order.chainId).displayName}</dd></div>
          <div><dt>接收钱包</dt><dd>{order.recipientAddress}</dd></div>
          <div><dt>ScoreNFT</dt><dd><a href={explorerAddressUrlFor(order.chainId, order.scoreContract)} target="_blank" rel="noreferrer">{order.scoreContract} ↗</a></dd></div>
          <div><dt>Order ID</dt><dd>{order.orderId}</dd></div>
          {hash && <div><dt>交易</dt><dd><a href={explorerTxUrlFor(order.chainId, hash)} target="_blank" rel="noreferrer">{hash} ↗</a></dd></div>}
        </dl>
        {needsWallet && !busy && !order.canContinue && (
          <p className="self-mint-status__notice">{walletAddress
            ? '当前钱包与接收地址不同；你可以查看进度，但不能继续签名。'
            : auth.walletsReady
              ? '原钱包尚未连接；连接后可以继续签名，不需要重新创建订单。'
              : '正在恢复原钱包连接，请稍候…'}</p>
        )}
        {error && <p className="self-mint-status__error" role="alert">{error}</p>}
        {recoverableHash && order.sendAttempted && !order.txHash && <p className="self-mint-status__notice">
          钱包已返回交易哈希：<a href={explorerTxUrlFor(order.chainId, recoverableHash)} target="_blank" rel="noreferrer">{recoverableHash} ↗</a>
        </p>}
        <div className="self-mint-status__actions">
          {needsWallet && !busy && !walletAddress && auth.authSource === 'privy' && auth.walletsReady && (
            <ReconnectMintWallet expectedAddress={order.recipientAddress}
              walletClientType={auth.walletCapability.walletClientType} />
          )}
          {canSend && <button type="button" disabled={busy} onClick={() => void send()}>{busy ? '正在打开钱包…' : '在钱包中确认铸造'}</button>}
          {recoverableHash && order.sendAttempted && !order.txHash && order.authorizationDigest && (
            <button type="button" disabled={busy} onClick={() => void recover()}>
              {busy ? '正在核对交易…' : '用已有交易哈希恢复'}
            </button>
          )}
          {order.status === 'success' && assetHref && <Link href={assetHref}>打开永久作品 →</Link>}
          {order.status === 'failed' && order.retryable && order.canContinue && (
            <button type="button" disabled={busy} onClick={() => void release()}>完成清查并重新选择</button>
          )}
          <button type="button" className="self-mint-status__quiet" disabled={busy}
            onClick={() => void load()}>刷新状态</button>
          {lastCheckedAt && <small className="self-mint-status__checked">上次读取 {lastCheckedAt}</small>}
        </div>
        </>}
      </section>
    </div>
  );
}
