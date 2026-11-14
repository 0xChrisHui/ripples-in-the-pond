'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { explorerAddressUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import type { OriginalDeployment } from '@/src/lib/music-catalog/types';

export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** 每条链一张卡：链名与标准 → 合约地址（可跳浏览器、可复制）+ 单曲页 → 这条链自己的收藏按钮（children）。 */
export default function ChainBlock({ deployment, children }: { deployment: OriginalDeployment; children?: ReactNode }) {
  const t = useTranslations('lens');
  const tp = useTranslations('provenance');
  const [copied, setCopied] = useState(false);
  const op = deployment.chainId === 10;
  const chain = op ? 'Optimism' : getChainDefinition(deployment.chainId).displayName.replace(' Mainnet', '');
  const standard = op ? 'SBT' : 'ERC-1155';
  const address = deployment.contractAddress;
  async function copy() {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
    catch { setCopied(false); }
  }
  const status = deployment.status === 'ready' ? t('ready')
    : deployment.status === 'undeployed' ? tp('undeployed') : tp('unverified');
  return (
    <section className="lens-chain" aria-label={`${chain} · ${standard}`} data-status={deployment.status}>
      <h3 className="lens-chain__name">
        <span className="lens-chain__dot" role="img" aria-label={status} />
        <span className="lens-chain__chain">{chain}</span>
        <span className="lens-chain__tag">{standard}</span>
        <span className="lens-chain__token">Token #{deployment.tokenId}</span>
        {deployment.status !== 'ready' && <span className="lens-chain__status-text">{status}</span>}
      </h3>
      <div className="lens-chain__facts">
        {address && <>
          <a className="lens-link lens-link--addr" href={explorerAddressUrlFor(deployment.chainId, address)} target="_blank" rel="noreferrer"
            aria-label={t('openExplorer', { chain })} title={address}>
            <span className="lens-chip"><code title={address}>{shortAddress(address)}</code>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg></span>
          </a>
          <button type="button" className="lens-link lens-link--icon" data-copied={copied || undefined} onClick={() => { void copy(); }}
            aria-label={t('copyContract', { chain })}>
            <span className="lens-chip lens-chip--icon">{copied
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" /></svg>}</span>
          </button></>}
        {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl} className="lens-link lens-link--page">{t('openSingle')}<span aria-hidden="true"> →</span></PondRouteLink>}
      </div>
      <span className="p11-visually-hidden" aria-live="polite">{copied ? t('copied') : ''}</span>
      {children}
    </section>
  );
}
