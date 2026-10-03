import rows from './data/tracks-source.json';
import artistNotesSource from './data/artist-notes.json';
import { knownCollections, OP_MATERIAL, OP_MATERIAL_URI, OP_ORIGINAL_SBT, unknownProof, awaitingArchive, originalVerification, originalReady } from './data/known-facts';
import { buildMaterialPlaybackRoute, resolveErc1155Uri } from './identity';
import { catalogRevision } from './canonical';
import type { MusicCatalog, OriginalTrack, OriginalDeployment } from './types';
export { validateMusicCatalog } from './validate';
export type { MusicCatalog, OriginalTrack, OriginalDeployment, MusicCollection } from './types';

const artistNotes: Partial<Record<number, string>> = artistNotesSource;
const tracks: OriginalTrack[] = rows.map((row) => ({
  trackId: row.id, displayNumber: row.week, title: row.title,
  audioArUri: `ar://${row.arweave_url.split('/').pop()}`, audioSha256: null,
  integrityMode: 'legacy_verified_source', notes: { status: artistNotes[row.week] ? 'final' : 'absent', text: artistNotes[row.week] ?? null },
  deployments: [
    { chainId: 10, status: originalReady(originalVerification(row.id)) ? 'ready' : 'unverified', contractAddress: OP_MATERIAL, tokenId: String(row.week),
      standard: 'ERC1155', metadataUri: resolveErc1155Uri(OP_MATERIAL_URI, String(row.week)),
      publicPlaybackUrl: buildMaterialPlaybackRoute(10, OP_MATERIAL, String(row.week)),
      archiveMint: awaitingArchive(), verification: originalVerification(row.id) },
    { chainId: 1, status: 'undeployed', contractAddress: null, tokenId: null, standard: 'ERC1155',
      metadataUri: null, publicPlaybackUrl: null, archiveMint: awaitingArchive(),
      verification: unknownProof('P17 本地批准边界', 'ETH 未部署，发行政策和生产签发待决') },
  ],
}));
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
  const current = getOriginalDeployment(trackId, chainId);
  if (!current || chainId !== 10) return current;
  const planned = OP_ORIGINAL_SBT;
  if (planned.contractAddress && planned.soulboundVerified && originalReady(planned.verification)
    && current.status === 'ready' && current.contractAddress?.toLowerCase() === planned.contractAddress.toLowerCase()) return current;
  // 即使仅登记新地址，也须等待其进入同revision的页面/SEMI正式发行记录。
  return { ...current, status: 'undeployed', contractAddress: null, metadataUri: null, publicPlaybackUrl: null,
    archiveMint: awaitingArchive(), verification: structuredClone(planned.verification) };
}
export function listEnabledCollections() { return getMusicCatalog().collections.filter((item) => item.enabled); }
export function listReadyOriginals() {
  return getMusicCatalog().tracks.flatMap((track) => track.deployments.filter((item) => item.status === 'ready')
    .map((deployment) => ({ track, deployment })));
}
