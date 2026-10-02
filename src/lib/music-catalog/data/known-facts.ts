import type { ArchiveMint, Verification, MusicCollection } from '../types';
import opProof from './op-source-proof.json';
import echoProof from './echo-source-proof.json';

export const OP_MATERIAL = '0x03504aeb95ebe3dc8c427b7b147f873f9948a299';
export const OP_MATERIAL_URI = 'ar://2LvJ7-D9xneN0McL5-zycmO_su0c3nUFfktmxZgbf28/{id}.json';
export const unknownProof = (source: string, reason: string): Verification => ({
  source, verifiedAt: null, blockNumber: null, bytecode: false, standard: false, uri: false, media: false, reason,
});
export const awaitingArchive = (): ArchiveMint => ({
  state: 'awaiting_input', recipient: null, amount: null, txHash: null, blockNumber: null,
  blockHash: null, logIndex: null, verifiedAt: null, proof: null,
});
// 新SBT尚未部署；只能在真实证明与同源目录接线完成后登记地址，禁止用旧OP合约代替。
export const OP_ORIGINAL_SBT: { contractAddress: string | null; soulboundVerified: boolean; verification: Verification } = {
  contractAddress: null, soulboundVerified: false,
  verification: unknownProof('2026-10-03用户批准新增OP原曲SBT', '本地实现，不代表实际部署/不可转让链读回'),
};
export function originalVerification(trackId: string): Verification {
  const row=opProof.results.find((item)=>item.trackId===trackId);
  return {source:'reviews/evidence/parallel-2026-10/20261002-night-01/p17/inventory/op-chain-proof.json + permanent-proof.json',
    verifiedAt:opProof.verifiedAt,blockNumber:opProof.blockNumber,bytecode:opProof.bytecode,standard:opProof.standard,
    uri:Boolean(opProof.frozen && row?.uri && row.metadata),media:Boolean(row?.media),
    reason:'永久metadata与原上传账本hash一致；音频HEAD/长度及既有永久来源对应，未承诺canonical音频hash'};
}
export function originalReady(verification: Verification) {
  return verification.bytecode && verification.standard && verification.uri && verification.media;
}
// 历史部署记录提供真实坐标；缺少本次有效读回时不进入 ready 清单。
export const knownCollections: MusicCollection[] = [
  { kind: 'original', chainId: 10, contractAddress: OP_MATERIAL, standard: 'ERC1155',
    metadataMethod: 'uri', playbackKind: 'audio', enabled: opProof.results.length===35 && opProof.results.every((item)=>originalReady(originalVerification(item.trackId))),
    verification: originalVerification(opProof.results[0].trackId) },
  { kind: 'score', chainId: 10, contractAddress: '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa', standard: 'ERC721',
    metadataMethod: 'tokenURI', playbackKind: 'html_decoder', enabled: false,
    verification: unknownProof('docs/MAINNET-RUNBOOK.md:26', '历史正式部署，本次未复核') },
  {kind:'echo',chainId:echoProof.chainId,contractAddress:echoProof.contractAddress,standard:'ERC721',
    metadataMethod:'tokenURI',playbackKind:'html_decoder',enabled:false,
    verification:{source:'reviews/evidence/parallel-2026-10/20261002-night-01/featured-echo-proof.json',
      verifiedAt:echoProof.verifiedAt,blockNumber:echoProof.blockNumber,bytecode:echoProof.codePresent,
      standard:false,uri:true,media:false,reason:'总控已核验tokenURI和三网关metadata，标准/实际播放完整Gate仍待K2'},
    samples:[{tokenId:echoProof.tokenId,metadataUri:echoProof.metadataUri,publicPlaybackUrl:`/echo/${echoProof.tokenId}`,
      verification:{source:'总控featured-echo-proof：三网关SHA256 '+echoProof.metadataSha256,
        verifiedAt:echoProof.verifiedAt,blockNumber:echoProof.blockNumber,bytecode:true,standard:false,uri:true,media:false,
        reason:'真实ECHO #1样例，尚不提升系列ready'}}]},
];
