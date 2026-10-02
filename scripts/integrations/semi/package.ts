import { getMusicCatalog, validateMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { buildCatalogAssetId, normalizeContract } from '../../../src/lib/music-catalog/identity';
import type { MusicCatalog, MusicCollection, OriginalDeployment, OriginalTrack, Verification } from '../../../src/lib/music-catalog/types';
import { renderReadme } from './readme';
import type { InventoryCollection, PackageFiles, SemiPackage } from './types';

function proofMissing(proof: Verification): string[] {
  const reasons = (['bytecode', 'standard', 'uri', 'media'] as const)
    .filter((key) => !proof[key]).map((key) => `verification.${key}_missing`);
  if (!proof.blockNumber) reasons.push('verification.blockNumber_missing');
  if (reasons.length && proof.reason) reasons.push(proof.reason);
  return reasons;
}
function collectionReasons(collection: MusicCollection): string[] {
  return [
    ...(![1, 10].includes(collection.chainId) ? ['non_production_chain'] : []),
    ...(!collection.enabled ? ['collection_disabled'] : []),
    ...proofMissing(collection.verification),
  ];
}
function deploymentReasons(track: OriginalTrack, item: OriginalDeployment, collections: InventoryCollection[]) {
  const collection = collections.find((row) => row.chainId === item.chainId && row.contractAddress === item.contractAddress);
  return [...new Set([
    ...(item.status !== 'ready' ? [`deployment_${item.status}`] : []),
    ...(![1, 10].includes(item.chainId) ? ['non_production_chain'] : []),
    ...(!item.contractAddress ? ['contractAddress_missing'] : []),
    ...(!item.tokenId ? ['tokenId_missing'] : []),
    ...(!item.metadataUri ? ['metadataUri_missing'] : []),
    ...(!item.publicPlaybackUrl ? ['publicPlaybackUrl_missing'] : []),
    ...(!track.audioArUri ? ['audioArUri_missing'] : []),
    ...(track.integrityMode === 'unverified' ? ['audio_integrity_unverified'] : []),
    ...(collection ? collection.readyExclusionReasons : ['collection_missing']),
    ...proofMissing(item.verification),
  ])];
}

// 地址只由唯一注册表派生；归档接收凭证与播放资料 ready 是不同状态。
export function buildSemiPackage(catalog: MusicCatalog = getMusicCatalog()): SemiPackage {
  const validation = validateMusicCatalog(catalog);
  if (!validation.valid) throw new Error(`注册表无效：${validation.errors.join('；')}`);
  const version = { schemaVersion: catalog.schemaVersion, revision: catalog.revision, environment: catalog.environment };
  const collections: InventoryCollection[] = catalog.collections.map((collection): InventoryCollection => ({
    ...structuredClone(collection),
    collectionKey: `eip155:${collection.chainId}/${normalizeContract(collection.contractAddress)}`,
    ownershipMethod: collection.standard === 'ERC1155' ? 'balanceOf(address,id)' : 'ownerOf(tokenId)',
    discovery: 'current_holder_index',
    sampleAssets: (collection.samples ?? []).map((sample) => buildCatalogAssetId(
      collection.chainId, collection.contractAddress, sample.tokenId, collection.standard)),
    sampleStatus: collection.samples?.length ? 'provided' : 'not_provided',
    readyExclusionReasons: collectionReasons(collection),
  })).sort((a, b) => a.chainId - b.chainId || a.contractAddress.localeCompare(b.contractAddress, 'en'));
  const tracks = [...catalog.tracks].sort((a, b) => a.displayNumber - b.displayNumber).map((track) => ({
    ...structuredClone(track),
    deployments: [...track.deployments].sort((a, b) => a.chainId - b.chainId).map((item) => ({
      ...structuredClone(item),
      assetId: item.contractAddress && item.tokenId
        ? buildCatalogAssetId(item.chainId, item.contractAddress, item.tokenId, item.standard) : null,
      readyExclusionReasons: deploymentReasons(track, item, collections),
    })),
  }));
  const readyCollections = collections.filter((item) => item.readyExclusionReasons.length === 0);
  const originals = tracks.flatMap(({ deployments, ...track }) => deployments
    .filter((item) => item.readyExclusionReasons.length === 0).map((deployment) => ({ ...track, deployment })));
  return {
    inventory: { ...version, tracks, collections },
    contracts: { ...version, collections: readyCollections },
    assets: { ...version, originals, dynamicCollections: readyCollections.filter((item) => item.kind !== 'original') },
  };
}
export function serializeSemiPackage(output: SemiPackage): PackageFiles {
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  return { 'catalog-inventory.json': json(output.inventory), 'contracts.ready.json': json(output.contracts),
    'assets.ready.json': json(output.assets), 'README.md': renderReadme(output) };
}
