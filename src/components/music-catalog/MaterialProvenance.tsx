'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import PondRouteLink from '../pond-shell/PondRouteLink';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';
import { arweaveGatewayUrls } from '../../lib/arweave/shared';
import type { OriginalTrack } from '../../lib/music-catalog/types';

/** 一行凭证：标签 / 完整原值 / 复制与浏览器核对；投资人与收藏者都不必展开任何内容。 */
function ProofRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const t = useTranslations('provenance');
  const [copied, setCopied] = useState(false), [failed, setFailed] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setFailed(false); }
    catch { setFailed(true); setCopied(false); }
  }
  return <div className="proof-row">
    <dt>{label}</dt>
    <dd><code className="material-uri">{value}</code>
      <span className="proof-row__actions">
        <button type="button" onClick={() => { void copy(); }} aria-label={t('copyLabel', { label })}>{copied ? t('copied') : t('copy')}</button>
        {href && <a href={href} target="_blank" rel="noreferrer" aria-label={t('verifyLabel', { label })}>{t('verify')}</a>}
        <span role="status">{failed ? t('copyFailed') : ''}</span>
      </span></dd>
  </div>;
}

export default function MaterialProvenance({ track }: { track: OriginalTrack }) {
  const t = useTranslations('provenance');
  const chainTitle = (chainId: number) => chainId === 10 ? `Optimism · ${t('sbt')}`
    : `${getChainDefinition(chainId).displayName.replace(' Mainnet', '')} · ${t('nft')}`;
  const audioUrl = arweaveGatewayUrls(track.audioArUri)[0];
  return <section className="material-provenance" aria-label={t('label')}>
    <h2>{t('title')}</h2>
    <p className="material-muted">{t('intro')}</p>
    <dl className="proof-card">
      {track.audioArUri ? <ProofRow label={t('audioUri')} value={track.audioArUri} href={audioUrl} />
        : <div className="proof-row"><dt>{t('audioUri')}</dt><dd>{t('audioPending')}</dd></div>}
      {track.audioSha256 && <ProofRow label={t('audioSha')} value={track.audioSha256} />}
    </dl>
    <p className="material-muted proof-note">{track.integrityMode === 'canonical_hash' ? t('canonical') : t('legacy')}</p>
    {track.deployments.map((deployment) => <article className="proof-card proof-chain"
      key={`${deployment.chainId}/${deployment.contractAddress}`}>
      <header className="material-proof-heading"><h3>{chainTitle(deployment.chainId)}</h3>
        {deployment.status !== 'ready' && <span data-status={deployment.status}>{deployment.status === 'undeployed' ? t('undeployed') : t('unverified')}</span>}
      </header>
      <dl>
        {deployment.contractAddress && <>
          <ProofRow label={t('contract')} value={deployment.contractAddress}
            href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)} />
          <div className="proof-row"><dt>{t('standard')}</dt><dd>ERC-1155 · Token #{deployment.tokenId}</dd></div></>}
        {deployment.archiveMint.txHash && <ProofRow label={t('archiveTx')} value={deployment.archiveMint.txHash}
          href={explorerTxUrlFor(deployment.chainId, deployment.archiveMint.txHash)} />}
        {deployment.archiveMint.recipient && <ProofRow label={t('archiveWallet')} value={deployment.archiveMint.recipient}
          href={explorerAddressUrlFor(deployment.chainId, deployment.archiveMint.recipient)} />}
        <div className="proof-row"><dt>{t('archive')}</dt>
          <dd>{deployment.archiveMint.state === 'confirmed' ? t('archiveConfirmed') : t('archivePending')}</dd></div>
      </dl>
      {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl}>{t('openSingle')}</PondRouteLink>}
    </article>)}
  </section>;
}
