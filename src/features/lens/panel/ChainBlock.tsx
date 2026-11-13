'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { explorerAddressUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import type { OriginalDeployment } from '@/src/lib/music-catalog/types';

export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** 紧凑链上信息块：链名 · 标准、合约（缩写可复制）、Token、状态、单曲页与区块浏览器。 */
export default function ChainBlock({ deployment, children }: { deployment: OriginalDeployment; children?: ReactNode }) {
  const t = useTranslations('lens');
  const tp = useTranslations('provenance');
  const [copied, setCopied] = useState(false);
  const op = deployment.chainId === 10;
  const chain = op ? 'Optimism' : getChainDefinition(deployment.chainId).displayName.replace(' Mainnet', '');
  const standard = op ? tp('sbt') : 'ERC-1155';
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
      <div className="lens-chain__heading">
        <h3 className="lens-chain__name"><span className="lens-chain__status" role="img" aria-label={status}>●</span> {chain} <span>· {standard} · Token #{deployment.tokenId}</span></h3>
        {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl} className="lens-link">{t('openSingle')} →</PondRouteLink>}
      </div>
      <p className="lens-chain__facts">
        {address && <><a className="lens-link" href={explorerAddressUrlFor(deployment.chainId, address)} target="_blank" rel="noreferrer"><code title={address}>{shortAddress(address)}</code> ↗</a>
          <button type="button" className="lens-link" onClick={() => { void copy(); }}
            aria-label={t('copyContract', { chain })}>{copied ? '✓' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></svg>}</button></>}
        {deployment.status !== 'ready' && <span className="lens-chain__status-text">{status}</span>}
      </p>
      <span className="p11-visually-hidden" aria-live="polite">{copied ? t('copied') : ''}</span>
      {children}
    </section>
  );
}
