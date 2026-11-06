'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import { explorerAddressUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import type { OriginalDeployment } from '@/src/lib/music-catalog/types';

export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** 紧凑链上信息块：链名 · 标准、合约（缩写可复制）、Token、状态、单曲页与区块浏览器。 */
export default function ChainBlock({ deployment }: { deployment: OriginalDeployment }) {
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
      <h3 className="lens-chain__name">{chain} <span>· {standard}</span></h3>
      {/* 一行：合约缩写 + 复制、Token、状态；不再逐项加小标签，省高度 */}
      <p className="lens-chain__facts">
        {address && <><code title={address}>{shortAddress(address)}</code>
          <button type="button" className="lens-link" onClick={() => { void copy(); }}
            aria-label={t('copyContract', { chain })}>{copied ? t('copied') : t('copy')}</button></>}
        {deployment.tokenId && <span className="lens-chain__token">#{deployment.tokenId}</span>}
        <span className="lens-chain__status">{status}</span>
      </p>
      <div className="lens-chain__links">
        {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl} className="lens-link">{t('openSingle')}</PondRouteLink>}
        {address && <a href={explorerAddressUrlFor(deployment.chainId, address)} target="_blank" rel="noreferrer"
          className="lens-link">{t('explorer')} ↗</a>}
      </div>
    </section>
  );
}
