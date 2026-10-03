import rows from './data/tracks-source.json';
import artistNotesSource from './data/artist-notes.json';
import metadataSource from './data/metadata-source.json';
import { knownCollections, ETH_ORIGINALS, OP_MATERIAL, OP_MATERIAL_URI, OP_ORIGINAL_SBT,
  awaitingArchive, originalArchive, deployedOriginalVerification, originalVerification } from './data/known-facts';
import { buildMaterialPlaybackRoute, resolveErc1155Uri } from './identity';
import { catalogRevision } from './canonical';
import type { MusicCatalog, OriginalTrack, OriginalDeployment } from './types';
export { validateMusicCatalog } from './validate';
export type { MusicCatalog, OriginalTrack, OriginalDeployment, MusicCollection } from './types';

const artistNotes: Partial<Record<number, string>> = artistNotesSource;
const tracks: OriginalTrack[] = rows.map((row) => {
  const metadata=metadataSource.find((item)=>item.tokenId===String(row.week));
  if(!metadata)throw new Error(`原曲${row.week}缺少永久metadata`);
  const metadataUri=`ar://${metadata.txId}`;
  return ({
  trackId: row.id, displayNumber: row.week, title: row.title,
  audioArUri: `ar://${row.arweave_url.split('/').pop()}`, audioSha256: null,
  integrityMode: 'legacy_verified_source', notes: { status: artistNotes[row.week] ? 'final' : 'absent', text: artistNotes[row.week] ?? null },
  deployments: [
    { chainId: 10, status: 'ready', contractAddress: OP_ORIGINAL_SBT.contractAddress, tokenId: String(row.week),
      standard: 'ERC1155', metadataUri, publicPlaybackUrl: buildMaterialPlaybackRoute(10, OP_ORIGINAL_SBT.contractAddress, String(row.week)),
      archiveMint: originalArchive(row.id, 10, OP_ORIGINAL_SBT.contractAddress, String(row.week)), verification: deployedOriginalVerification(10) },
    { chainId: 1, status: 'ready', contractAddress: ETH_ORIGINALS, tokenId: String(row.week), standard: 'ERC1155',
      metadataUri, publicPlaybackUrl: buildMaterialPlaybackRoute(1, ETH_ORIGINALS, String(row.week)),
      archiveMint: originalArchive(row.id, 1, ETH_ORIGINALS, String(row.week)),
      verification: deployedOriginalVerification(1) },
  ],
  });
});
const content = { schemaVersion: 1 as const, environment: 'production' as const, tracks, collections: knownCollections };
const catalog: MusicCatalog = { ...content, revision: catalogRevision(content) };

// 返回副本，消费者不能通过修改目录对象改变另一条执行线的数据。
export function getMusicCatalog(): MusicCatalog { return structuredClone(catalog); }
export function getOriginalTrack(trackId: string): OriginalTrack | null {
  return getMusicCatalog().tracks.find((track) => track.trackId === trackId) ?? null;
}
export function getOriginalDeployment(trackId: string, chainId: number): OriginalDeployment | null {
  return getOriginalTrack(trackId)?.deployments.find((item) => item.chainId === chainId) ?? null;
}
/** 公开历史发行与今后的领取目标分开；地址仍只读同一registry。 */
export function getOriginalMintDeployment(trackId: string, chainId: number): OriginalDeployment | null {
  return getOriginalDeployment(trackId, chainId);
}
export function getLegacyOriginalDeployment(trackId:string):OriginalDeployment|null {
  const track=getOriginalTrack(trackId); if(!track)return null;
  return {chainId:10,status:'ready',contractAddress:OP_MATERIAL,tokenId:String(track.displayNumber),standard:'ERC1155',
    metadataUri:resolveErc1155Uri(OP_MATERIAL_URI,String(track.displayNumber)),
    publicPlaybackUrl:buildMaterialPlaybackRoute(10,OP_MATERIAL,String(track.displayNumber)),
    archiveMint:awaitingArchive(),verification:originalVerification(trackId)};
}
export function findOriginalTrackByAsset(chainId:number,contract:string,tokenId:string):OriginalTrack|null {
  const normalized=contract.toLowerCase();
  return getMusicCatalog().tracks.find((track)=>track.deployments.some((item)=>item.chainId===chainId
    && item.contractAddress?.toLowerCase()===normalized&&item.tokenId===tokenId&&item.status!=='undeployed')
    ||(chainId===10&&normalized===OP_MATERIAL&&String(track.displayNumber)===tokenId))??null;
}
export function listEnabledCollections() { return getMusicCatalog().collections.filter((item) => item.enabled); }
export function listReadyOriginals() {
  return getMusicCatalog().tracks.flatMap((track) => track.deployments.filter((item) => item.status === 'ready')
    .map((deployment) => ({ track, deployment })));
}
