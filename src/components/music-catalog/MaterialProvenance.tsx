'use client';
import { useState } from 'react';
import PondRouteLink from '../pond-shell/PondRouteLink';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';
import { arweaveGatewayUrls } from '../../lib/arweave/shared';
import type { OriginalTrack } from '../../lib/music-catalog/types';

/** 一行凭证：标签 / 完整原值 / 复制与浏览器核对；投资人与收藏者都不必展开任何内容。 */
function ProofRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false), [failed, setFailed] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setFailed(false); }
    catch { setFailed(true); setCopied(false); }
  }
  return <div className="proof-row">
    <dt>{label}</dt>
    <dd><code className="material-uri">{value}</code>
      <span className="proof-row__actions">
        <button type="button" onClick={() => { void copy(); }} aria-label={`复制${label}`}>{copied ? '已复制' : '复制'}</button>
        {href && <a href={href} target="_blank" rel="noreferrer" aria-label={`在浏览器中核对${label}`}>核对 ↗</a>}
        <span role="status">{failed ? '未能复制，请选中完整内容复制。' : ''}</span>
      </span></dd>
  </div>;
}

const chainTitle = (chainId: number) => chainId === 10 ? 'Optimism · 原曲 SBT'
  : `${getChainDefinition(chainId).displayName.replace(' Mainnet', '')} · 原曲 NFT`;

export default function MaterialProvenance({ track }: { track: OriginalTrack }) {
  const audioUrl = arweaveGatewayUrls(track.audioArUri)[0];
  return <section className="material-provenance" aria-label="永久来源与链上凭证">
    <h2>永久来源</h2>
    <p className="material-muted">音频永久保存在 Arweave，不依赖本站；收藏凭证来自链上合约，下列每一项都可在区块浏览器核对。</p>
    <dl className="proof-card">
      {track.audioArUri ? <ProofRow label="音频永久地址" value={track.audioArUri} href={audioUrl} />
        : <div className="proof-row"><dt>音频永久地址</dt><dd>来源尚待核验</dd></div>}
      {track.audioSha256 && <ProofRow label="音频 SHA-256" value={track.audioSha256} />}
    </dl>
    <p className="material-muted proof-note">{track.integrityMode === 'canonical_hash' ? '已记录永久承诺的音频校验值。'
      : '沿用已有永久音频来源；历史 metadata 未承诺音频 SHA-256。'}</p>
    {track.deployments.map((deployment) => <article className="proof-card proof-chain"
      key={`${deployment.chainId}/${deployment.contractAddress}`}>
      <header className="material-proof-heading"><h3>{chainTitle(deployment.chainId)}</h3>
        <span data-status={deployment.status}>{deployment.status === 'ready' ? '✓ 凭证已核验'
          : deployment.status === 'undeployed' ? '尚未部署' : '凭证待核验'}</span></header>
      <dl>
        {deployment.contractAddress && <>
          <ProofRow label="铸造合约" value={deployment.contractAddress}
            href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)} />
          <div className="proof-row"><dt>标准 / Token</dt><dd>ERC-1155 · Token #{deployment.tokenId}</dd></div></>}
        {deployment.archiveMint.txHash && <ProofRow label="项目留存交易" value={deployment.archiveMint.txHash}
          href={explorerTxUrlFor(deployment.chainId, deployment.archiveMint.txHash)} />}
        {deployment.archiveMint.recipient && <ProofRow label="项目留存钱包" value={deployment.archiveMint.recipient}
          href={explorerAddressUrlFor(deployment.chainId, deployment.archiveMint.recipient)} />}
        <div className="proof-row"><dt>项目留存</dt>
          <dd>{deployment.archiveMint.state === 'confirmed' ? '已确认' : '尚待接收钱包与链上证明'}</dd></div>
      </dl>
      {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl}>打开单曲 →</PondRouteLink>}
    </article>)}
  </section>;
}
