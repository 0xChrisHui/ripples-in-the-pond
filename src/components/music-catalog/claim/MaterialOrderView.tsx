'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import PondRouteLink from '../../pond-shell/PondRouteLink';
import PageNavigation from '../../pond-shell/navigation/PageNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress, type Hex } from 'viem';
import { useAuth } from '../../../hooks/useAuth';
import { useMaterialMint } from '../../../features/material-catalog/mint/useMaterialMint';
import { canSendMaterialOrder, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { describeMaterialError, useMaterialErrorCopy, type MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import { formatEth, readGasHint, type GasHint } from '../../../features/material-catalog/mint/gas-hint';
import MaterialNoticeView from './MaterialNoticeView';
import { readMaterialHash } from '../../../features/material-catalog/mint/attempt-cache';
import { getMusicCatalog, getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../../lib/chain/multichain/registry';

const STEPS = ['stepCreated', 'stepWallet', 'stepChain'] as const;
/** 当前进行到第几步（0 起）；success 之后三步全部完成。 */
function stepIndex(status: PublicMaterialOrder['status']) {
  if (status === 'success') return 3;
  if (['sending', 'unknown', 'submitted', 'confirming'].includes(status)) return 2;
  return 1;
}

export default function MaterialOrderView({ orderId, embedded = false }: { orderId: Hex; embedded?: boolean }) {
  const t = useTranslations('material'), copy = useMaterialErrorCopy();
  const auth = useAuth(), { getOrder, sendOrder, recoverOrder } = useMaterialMint();
  const owner = auth.userId, scope = `${owner}:${orderId}`, activeScope = useRef(scope); activeScope.current = scope;
  const [loaded, setLoaded] = useState<{ owner: string; order: PublicMaterialOrder } | null>(null);
  const [notice, setNotice] = useState<{ scope: string; notice: MaterialNotice } | null>(null);
  const [busy, setBusy] = useState(false), [cachedHash, setCachedHash] = useState<Hex | null>(null);
  const [hashInput, setHashInput] = useState<{ scope: string; value: string } | null>(null);
  const [gas, setGas] = useState<{ key: string; hint: GasHint | null } | null>(null);
  const enteredHash = hashInput?.scope === scope ? hashInput.value : '';
  const order = auth.authenticated && loaded?.owner === owner && loaded.order.orderId === orderId ? loaded.order : null;
  const load = useCallback(async () => {
    if (!owner) return;
    const next = await getOrder(orderId); if (activeScope.current !== scope) return;
    const cached = readMaterialHash({ userId: owner, environment: getMusicCatalog().environment, chainId: next.chainId,
      contractAddress: next.contractAddress, recipientAddress: next.recipientAddress, orderId });
    setLoaded({ owner, order: next }); setCachedHash(cached); setNotice(null);
  }, [getOrder, orderId, owner, scope]);
  useEffect(() => {
    if (!auth.authenticated) return;
    let active = true;
    void load().catch(error => { if (active && activeScope.current === scope) setNotice({ scope,
      notice: describeMaterialError(error, copy, t('order.unavailable')) }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 文案随语言变化不应重新读取订单
  }, [auth.authenticated, load, scope]);
  async function act(action: 'send' | 'recover' | 'refresh') {
    if (busy) return; setBusy(true); setNotice(null);
    try {
      if (action === 'send') await sendOrder(orderId);
      if (action === 'recover') await recoverOrder(orderId, enteredHash.trim() ? enteredHash.trim().toLowerCase() as Hex : undefined);
      await load();
    } catch (caught) {
      const failure = describeMaterialError(caught, copy, t('order.requestUnavailable'));
      if (activeScope.current === scope) setNotice({ scope, notice: failure });
      // 钱包拒绝/失败后订单状态已变化；静默刷新让按钮与步骤同步，同时保留上面的提示。
      if (action === 'send') await load().then(() => { if (activeScope.current === scope) setNotice({ scope,
        notice: failure }); }).catch(() => undefined);
    }
    finally { setBusy(false); }
  }
  const deployment = order && getOriginalDeployment(order.trackId, order.chainId);
  const sameWallet = order && auth.walletCapability.walletKind === 'external' && auth.selectedExternalWallet
    && getAddress(auth.selectedExternalWallet.address) === order.recipientAddress;
  const ready = deployment?.status === 'ready' && deployment.contractAddress?.toLowerCase() === order?.contractAddress.toLowerCase();
  const recoverable = order && order.digest && ['sending', 'unknown', 'submitted', 'confirming'].includes(order.status);
  const validHash = /^0x[0-9a-f]{64}$/i.test(enteredHash.trim()) && !/^0x0+$/i.test(enteredHash.trim());
  const asset = ready && deployment?.tokenId === order?.tokenId ? deployment.publicPlaybackUrl : null;
  const sendable = Boolean(order && canSendMaterialOrder(order) && !cachedHash && sameWallet);
  const wallet = auth.selectedExternalWallet, gasKey = order ? `${order.orderId}:${order.version}` : '';
  useEffect(() => {
    if (!order || !sendable || !wallet) return;
    let active = true;
    void wallet.getEthereumProvider().then(provider => readGasHint(provider, getAddress(wallet.address), order.chainId))
      .then(hint => { if (active) setGas({ key: gasKey, hint }); }).catch(() => { if (active) setGas({ key: gasKey, hint: null }); });
    return () => { active = false; };
  }, [order, sendable, wallet, gasKey]);
  const gasHint = gas?.key === gasKey ? gas.hint : null;
  const Container = embedded ? 'section' : 'main', Heading = embedded ? 'h4' : 'h2';
  const finished = order && ['success', 'cancelled'].includes(order.status);
  const current = order ? stepIndex(order.status) : 0;
  return <Container className={embedded ? 'material-inline-claim' : 'material-catalog'} data-material-claim-inline={embedded || undefined}>
    {!embedded && <><PageNavigation />
      <nav className="material-header" aria-label={t('order.backToMe')}><PondRouteLink href="/me">{t('order.backLink')}</PondRouteLink></nav>
      <div className="material-intro"><h1>{t('order.statusTitle')}</h1><p>{t('order.statusIntro')}</p></div></>}
    {!auth.ready ? <p role="status">{t('order.checkingSignIn')}</p> : !auth.authenticated
      ? <button className="material-collect" type="button" onClick={auth.openLoginModal}>{t('order.signInToView')}</button>
      : <section className="material-mint" aria-live="polite">
        {!order ? <p>{t('order.loading')}</p> : <>
          <Heading className="material-order-title">{t(`status.${order.status}`)}</Heading>
          <p className="material-muted">{t('order.summary', { chain: getChainDefinition(order.chainId).displayName, tokenId: order.tokenId })}</p>
          {order.status !== 'cancelled' && <ol className="material-steps" aria-label={t('order.progress')}>
            {STEPS.map((label, index) => <li key={label} data-state={index < current ? 'done' : index === current ? 'current' : 'todo'}
              aria-current={index === current ? 'step' : undefined}><span aria-hidden="true">{index < current ? '✓' : index + 1}</span>{t(`order.${label}`)}</li>)}
          </ol>}
          {!embedded && sendable && gasHint && <p className="material-gas" data-low={!gasHint.enough || undefined}>
            {t('order.gas', { fee: formatEth(gasHint.fee), balance: formatEth(gasHint.balance) })}
            {!gasHint.enough && t('order.gasLow')}</p>}
          {!embedded && canSendMaterialOrder(order) && !cachedHash && <button className="material-collect" type="button"
            disabled={busy || !sameWallet || !ready || gasHint?.enough === false}
            onClick={() => { void act('send'); }}>{busy ? t('order.waitingWallet') : t('order.send')}</button>}
          {recoverable && <details className="material-proof-details"><summary>{t('order.recoverSummary')}</summary><label>{t('order.existingHash')} <input aria-label={t('order.existingHashLabel')} type="text" value={enteredHash}
            onChange={event => setHashInput({ scope, value: event.target.value })} disabled={busy} autoComplete="off" spellCheck={false} /></label>
            <button className="material-collect" type="button" disabled={busy || !sameWallet || (enteredHash.trim() ? !validHash : !cachedHash)}
              onClick={() => { void act('recover'); }}>{t('order.recover')}</button>
            <p className="material-muted">{t('order.recoverNote')}</p></details>}
          {!embedded && !sameWallet && (canSendMaterialOrder(order) || recoverable) && <p className="material-muted">{t('order.connectRecipient')}</p>}
          {order.status === 'sending' && !cachedHash && <p className="material-muted">{t('order.sendingNote')}</p>}
          {order.status === 'success' && <p className="material-muted">{t('order.successNote')}</p>}
          {order.status === 'success' && asset && <Link href={asset}>{t('order.openTrack')}</Link>}
          {order.txHash && <p className="material-muted"><a href={explorerTxUrlFor(order.chainId, order.txHash)} target="_blank" rel="noreferrer">{t('order.viewTx')}</a></p>}
          <details className="material-proof-details"><summary>{t('order.details')}</summary>
            <p className="material-uri">{t('order.recipientLine', { address: order.recipientAddress })}</p>
            <p className="material-uri">{t('order.contractLine')}<a href={explorerAddressUrlFor(order.chainId, order.contractAddress)} target="_blank" rel="noreferrer">{order.contractAddress}</a></p>
            {order.txHash && <p className="material-uri">{t('tx', { hash: order.txHash })}</p>}
          </details>
        </>}
        {!finished && <p><button className="material-refresh" type="button" disabled={busy} onClick={() => { void act('refresh'); }}>
          {busy ? t('order.processing') : t('order.refresh')}</button></p>}
      </section>}
    {auth.authenticated && notice?.scope === scope && <MaterialNoticeView notice={notice.notice} />}
  </Container>;
}
