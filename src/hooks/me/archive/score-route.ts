import type { OwnedScoreNFT } from '@/src/types/jam';

/** 打开与预取必须共用完整链身份，防止不同链的同号唱片串页。 */
export function ownedScoreHref(score: OwnedScoreNFT): string {
  return score.mintMode === 'eth_self_paid' && score.status === 'success'
    && score.tokenId != null && score.chainId && score.contractAddress
    ? `/score/${score.chainId}/${score.contractAddress.toLowerCase()}/${score.tokenId}`
    : `/score/${score.id}`;
}
