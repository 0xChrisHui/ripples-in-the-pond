import Link from 'next/link';
import { explorerAddressUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';
import type { OriginalTrack } from '../../lib/music-catalog/types';

export default function MaterialProvenance({ track }: { track: OriginalTrack }) {
  return <section className="material-provenance" aria-label="永久来源与链上凭证">
    <h3>永久来源</h3><p className="material-uri">{track.audioArUri ?? '音频来源尚待核验'}</p>
    <p className="material-muted">{track.integrityMode === 'canonical_hash' ? '已记录永久承诺的音频校验值'
      : '沿用已有永久音频来源；历史 metadata 未承诺音频 SHA-256。'}</p>
    {track.deployments.map((deployment) => <div className="material-network-proof" key={deployment.chainId}>
      <div><strong>{getChainDefinition(deployment.chainId).displayName}{deployment.chainId === 10 ? ' · 旧版原曲' : ''}</strong><span>
        {deployment.status === 'ready' ? '凭证已核验' : deployment.status === 'undeployed' ? '尚未部署' : '凭证待核验'}</span></div>
      {deployment.contractAddress && <><a href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)}
        target="_blank" rel="noreferrer" className="material-uri">{deployment.contractAddress}</a>
        <p>ERC-1155 · Token #{deployment.tokenId}</p></>}
      {deployment.publicPlaybackUrl && <Link href={deployment.publicPlaybackUrl}>打开单曲唱片 →</Link>}
      <p className="material-muted">项目留存：{deployment.archiveMint.state === 'confirmed' ? '已确认' : '尚待接收钱包与链上证明'}</p>
    </div>)}
  </section>;
}
