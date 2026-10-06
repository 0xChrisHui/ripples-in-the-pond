'use client';
import { useState } from 'react';
import PondRouteLink from '../pond-shell/PondRouteLink';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';
import { arweaveGatewayUrls } from '../../lib/arweave/shared';
import type { OriginalTrack } from '../../lib/music-catalog/types';

function ProofValue({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(value); setFailed(null); }
    catch { setFailed(value); setCopied(null); }
  }
  return <details className="material-proof-details">
    <summary>{label}<span className="material-proof-preview">{value.slice(0, 8)}…{value.slice(-6)}</span></summary>
    <p className="material-uri">{href ? <a href={href} target="_blank" rel="noreferrer">{value} ↗</a> : value}</p>
    <div className="material-proof-actions"><button type="button" onClick={() => { void copy(); }} aria-label={`复制${label}`}>
      {copied === value ? '已复制' : '复制'}</button>
      <span role="status">{failed === value ? '未能复制，请选中完整内容复制。' : copied === value ? `${label}已复制` : ''}</span>
    </div>
  </details>;
}

export default function MaterialProvenance({ track }: { track: OriginalTrack }) {
  const audioUrl = arweaveGatewayUrls(track.audioArUri)[0];
  return <section className="material-provenance" aria-label="永久来源与链上凭证">
    <h3>永久来源</h3>
    {track.audioArUri ? <ProofValue label="音频永久地址" value={track.audioArUri} href={audioUrl} />
      : <p className="material-muted">音频来源尚待核验</p>}
    {audioUrl && <a href={audioUrl} target="_blank" rel="noreferrer" className="material-proof-link">打开永久音频 ↗</a>}
    <p className="material-muted">{track.integrityMode === 'canonical_hash' ? '已记录永久承诺的音频校验值'
      : '沿用已有永久音频来源；历史 metadata 未承诺音频 SHA-256。'}</p>
    {track.audioSha256 && <ProofValue label="音频 SHA-256" value={track.audioSha256} />}
    {track.deployments.map((deployment) => <div className="material-network-proof"
      key={`${deployment.chainId}/${deployment.contractAddress}`}>
      <div className="material-proof-heading"><strong>{getChainDefinition(deployment.chainId).shortName.toUpperCase()}
        {deployment.chainId === 10 ? ' · 原曲 SBT' : ' · 原曲 NFT'}</strong><span>
        {deployment.status === 'ready' ? '凭证已核验' : deployment.status === 'undeployed' ? '尚未部署' : '凭证待核验'}</span></div>
      {deployment.contractAddress && <><a href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)}
        target="_blank" rel="noreferrer" className="material-proof-link">铸造合约 ↗</a>
        <p>ERC-1155 · Token #{deployment.tokenId}</p></>}
      {deployment.archiveMint.state === 'confirmed' && deployment.archiveMint.txHash
        && <a href={explorerTxUrlFor(deployment.chainId, deployment.archiveMint.txHash)}
          target="_blank" rel="noreferrer" className="material-proof-link">本曲项目留存铸造 ↗</a>}
      {deployment.contractAddress && <ProofValue label="合约完整地址" value={deployment.contractAddress}
        href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)} />}
      {deployment.archiveMint.txHash && <ProofValue label="项目留存交易" value={deployment.archiveMint.txHash}
        href={explorerTxUrlFor(deployment.chainId, deployment.archiveMint.txHash)} />}
      {deployment.archiveMint.recipient && <ProofValue label="项目留存钱包" value={deployment.archiveMint.recipient}
        href={explorerAddressUrlFor(deployment.chainId, deployment.archiveMint.recipient)} />}
      {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl}>打开单曲 →</PondRouteLink>}
      <p className="material-muted">项目留存：{deployment.archiveMint.state === 'confirmed' ? '已确认' : '尚待接收钱包与链上证明'}</p>
    </div>)}
  </section>;
}
