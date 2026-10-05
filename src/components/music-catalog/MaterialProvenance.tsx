import PondRouteLink from '../pond-shell/PondRouteLink';
import { explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition } from '../../lib/chain/multichain/registry';
import type { OriginalTrack } from '../../lib/music-catalog/types';

export default function MaterialProvenance({ track }: { track: OriginalTrack }) {
  return <section className="material-provenance" aria-label="永久来源与链上凭证">
    <h3>永久来源</h3><p className="material-uri">{track.audioArUri ?? '音频来源尚待核验'}</p>
    <p className="material-muted">{track.integrityMode === 'canonical_hash' ? '已记录永久承诺的音频校验值'
      : '沿用已有永久音频来源；历史 metadata 未承诺音频 SHA-256。'}</p>
    {track.deployments.map((deployment) => <div className="material-network-proof"
      key={`${deployment.chainId}/${deployment.contractAddress}`}>
      <div><strong>{getChainDefinition(deployment.chainId).shortName.toUpperCase()}
        {deployment.chainId === 10 ? ' · 原曲 SBT' : ' · 原曲 NFT'}</strong><span>
        {deployment.status === 'ready' ? '凭证已核验' : deployment.status === 'undeployed' ? '尚未部署' : '凭证待核验'}</span></div>
      {deployment.contractAddress && <><a href={explorerAddressUrlFor(deployment.chainId, deployment.contractAddress)}
        target="_blank" rel="noreferrer" className="material-proof-link">铸造合约 ↗</a>
        <p>ERC-1155 · Token #{deployment.tokenId}</p></>}
      {deployment.archiveMint.state === 'confirmed' && deployment.archiveMint.txHash
        && <a href={explorerTxUrlFor(deployment.chainId, deployment.archiveMint.txHash)}
          target="_blank" rel="noreferrer" className="material-proof-link">本曲项目留存铸造 ↗</a>}
      {deployment.contractAddress && <details className="material-proof-details"><summary>完整地址</summary>
        <p className="material-uri">{deployment.contractAddress}</p>
        {deployment.archiveMint.recipient && <p className="material-uri">留存钱包：{deployment.archiveMint.recipient}</p>}
      </details>}
      {deployment.publicPlaybackUrl && <PondRouteLink href={deployment.publicPlaybackUrl}>打开单曲 →</PondRouteLink>}
      <p className="material-muted">项目留存：{deployment.archiveMint.state === 'confirmed' ? '已确认' : '尚待接收钱包与链上证明'}</p>
    </div>)}
  </section>;
}
