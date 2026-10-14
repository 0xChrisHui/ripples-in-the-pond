'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Hex } from 'viem';
import { explorerTxUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import { useAuth } from '@/src/hooks/useAuth';
import { useEthereumScoreMint, type MintGasEstimate } from '@/src/hooks/useEthereumScoreMint';
import { forgetMintHash, readMintHash, recoverMintHash } from '@/src/lib/self-mint/client-hash';
import { useServerText } from '@/src/i18n/use-server-text';
import ReconnectMintWallet from './ReconnectMintWallet';
import MintOrderFacts from './MintOrderFacts';
import { useMintDialogFocus } from './hooks/useMintDialogFocus';
import { useSerialRefresh } from './hooks/useSerialRefresh';
import { formatGasUsd, selfMintCopyKey, type PublicOrder } from './self-mint-copy';
import './self-mint-status.css';
/** key：英文模式显示的前端文案；server：服务端/钱包原文，中文模式照旧显示（P19 F5） */
type ViewError = { key: 'readFailed' | 'gasFailed' | 'sendFailed' | 'recoverFailed' | 'releaseFailed'; server?: string };
const failure = (key: ViewError['key'], caught: unknown): ViewError => ({ key, server: caught instanceof Error ? caught.message : undefined });
export default function SelfMintOrderView({ orderId, onClose }: {
  orderId: Hex; onClose: () => void;
}) {
  const t = useTranslations('selfMint'), tc = useTranslations('common'), serverText = useServerText();
  const auth = useAuth();
  const getAccessToken = auth.getAccessToken;
  const { prepareOrder, sendOrder } = useEthereumScoreMint();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<ViewError | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [recoverableHash, setRecoverableHash] = useState<Hex | null>(null);
  const [gasQuote, setGasQuote] = useState<{ orderId: Hex; value: MintGasEstimate } | null>(null);
  const [gasError, setGasError] = useState<ViewError | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const lastAdvanceKickRef = useRef(0);
  closeRef.current = onClose;
  busyRef.current = busy;
  const walletAddress = auth.selectedExternalWallet?.address ?? null;
  const errorText = (value: ViewError) => serverText(value.server, t(`errors.${value.key}`));

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
    const shouldAdvance = result.status === 'preparing_assets' || result.status === 'submitted'
      || result.status === 'confirming' || (result.status === 'manual_review' && result.sendAttempted);
    if (shouldAdvance && Date.now() - lastAdvanceKickRef.current >= 5_000) {
      lastAdvanceKickRef.current = Date.now();
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

  useSerialRefresh(load, busy, (caught) => { setError(failure('readFailed', caught)); });

  const loadGas = useCallback(async () => {
    setGasError(null);
    try {
      const value = await prepareOrder(orderId);
      setGasQuote({ orderId, value });
    } catch (caught) {
      setGasError(failure('gasFailed', caught));
    }
  }, [orderId, prepareOrder]);

  async function send() {
    setBusy(true);
    setError(null);
    try { if (order) await sendOrder(orderId, order.chainId); await load(); }
    catch (caught) { setError(failure('sendFailed', caught)); }
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
    } catch (caught) { setError(failure('recoverFailed', caught)); }
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
      setError(failure('releaseFailed', caught));
      setBusy(false);
    }
  }

  const chainName = order ? getChainDefinition(order.chainId).displayName : 'Ethereum';
  const copyKey = order && selfMintCopyKey(order, busy);
  const hash = order && (order.replacementTxHash ?? order.txHash ?? order.failedTxHash);
  const canSend = order && !order.sendAttempted && !recoverableHash
    && order.canContinue && auth.walletCapability.canSelfPayEthGas
    && (order.status === 'ready_to_sign' || order.status === 'expired');
  const showGas = order && !order.sendAttempted
    && (order.status === 'ready_to_sign' || order.status === 'expired');
  const needsWallet = order && (order.status === 'ready_to_sign' || order.status === 'expired'
    || (order.status === 'failed' && order.retryable));
  const assetHref = order && `/score/${order.chainId}/${order.scoreContract.toLowerCase()}/${order.tokenId}`;
  const gasEstimate = gasQuote?.orderId === orderId ? gasQuote.value : null;

  useEffect(() => {
    if (canSend) void loadGas();
  }, [canSend, loadGas]);

  if (!order && !error) return null;

  return (
    <div className="self-mint-status" data-p11-theme="archive" data-status={order?.status}
      role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}>
      <section ref={dialogRef} tabIndex={-1} className="self-mint-status__sheet" role="dialog"
        aria-modal="true" aria-labelledby="self-mint-title">
        <header>
          <div className="self-mint-status__brand">
            <span>SELF-PAID SCORE</span>
            <strong>{chainName}</strong>
          </div>
          <button type="button" className="self-mint-status__close" aria-label={t('close')}
            disabled={busy} onClick={onClose}>×</button>
        </header>
        {!order ? <><h2 id="self-mint-title">{t('progress')}</h2>
          <p className="self-mint-status__loading" role="status">{error ? errorText(error) : t('loading')}</p>
          {error && <div className="self-mint-status__actions"><button type="button"
            onClick={() => void load()}>{tc('retry')}</button></div>}
        </> : <>
        <p className="self-mint-status__eyebrow">{t('eyebrow', { tokenId: order.tokenId })}</p>
        <h2 id="self-mint-title">{copyKey && t(`copy.${copyKey}.title`)}</h2>
        <p className="self-mint-status__lead" aria-live="polite">{copyKey && t(`copy.${copyKey}.detail`, { chain: chainName })}</p>
        <MintOrderFacts order={order} hash={hash} showGas={Boolean(showGas)}
          estimateActive={Boolean(canSend)} gasEstimate={gasEstimate} gasError={gasError?.key ?? null} />
        {needsWallet && !busy && !order.canContinue && (
          <p className="self-mint-status__notice">{t(walletAddress ? 'walletMismatch'
            : auth.walletsReady ? 'walletNotConnected' : 'walletRestoring')}</p>
        )}
        {error && <p className="self-mint-status__error" role="alert">{errorText(error)}</p>}
        {gasEstimate && !gasEstimate.enough && <p className="self-mint-status__error" role="alert">
          {t('insufficient')}
        </p>}
        {gasError && <p className="self-mint-status__error" role="alert">{errorText(gasError)}</p>}
        {recoverableHash && order.sendAttempted && !order.txHash && <p className="self-mint-status__notice">
          {t('returnedHash')}<a href={explorerTxUrlFor(order.chainId, recoverableHash)} target="_blank" rel="noreferrer">{recoverableHash} ↗</a>
        </p>}
        <div className="self-mint-status__actions">
          {needsWallet && !busy && !walletAddress && auth.authSource === 'privy' && auth.walletsReady && (
            <ReconnectMintWallet expectedAddress={order.recipientAddress}
              walletClientType={auth.walletCapability.walletClientType} />
          )}
          {canSend && <button type="button" disabled={busy || !gasEstimate?.enough}
            onClick={() => void send()}>{busy ? t('openingWallet') : gasEstimate?.enough
              ? t('confirmMint', { usd: formatGasUsd(gasEstimate.usd) })
              : gasEstimate ? t('noBalance') : t('waitingGas')}</button>}
          {canSend && gasError && <button type="button" className="self-mint-status__quiet"
            disabled={busy} onClick={() => void loadGas()}>{t('reestimate')}</button>}
          {recoverableHash && order.sendAttempted && !order.txHash && order.authorizationDigest && (
            <button type="button" disabled={busy} onClick={() => void recover()}>
              {busy ? t('checkingTx') : t('recoverHash')}
            </button>
          )}
          {order.status === 'success' && assetHref && <Link href={assetHref}>{t('openWork')}</Link>}
          {order.status === 'failed' && order.retryable && order.canContinue && (
            <button type="button" disabled={busy} onClick={() => void release()}>{t('release')}</button>
          )}
          <button type="button" className="self-mint-status__quiet" disabled={busy}
            onClick={() => void load()}>{t('refresh')}</button>
          {lastCheckedAt && <small className="self-mint-status__checked">{t('lastChecked', { time: lastCheckedAt })}</small>}
        </div>
        </>}
      </section>
    </div>
  );
}
