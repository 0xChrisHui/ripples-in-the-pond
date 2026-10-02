import type { MusicCatalog, MusicCollection, OriginalDeployment, OriginalTrack } from '../../../src/lib/music-catalog/types';

export type Version = Pick<MusicCatalog, 'schemaVersion' | 'revision' | 'environment'>;
export type InventoryDeployment = OriginalDeployment & {
  assetId: string | null;
  readyExclusionReasons: string[];
};
export type InventoryTrack = Omit<OriginalTrack, 'deployments'> & { deployments: InventoryDeployment[] };
export type InventoryCollection = MusicCollection & {
  collectionKey: string;
  ownershipMethod: 'balanceOf(address,id)' | 'ownerOf(tokenId)';
  discovery: 'current_holder_index';
  sampleAssets: string[];
  sampleStatus: 'not_provided' | 'provided';
  readyExclusionReasons: string[];
};
export type SemiPackage = {
  inventory: Version & { tracks: InventoryTrack[]; collections: InventoryCollection[] };
  contracts: Version & { collections: InventoryCollection[] };
  assets: Version & {
    originals: (Omit<InventoryTrack, 'deployments'> & { deployment: InventoryDeployment })[];
    dynamicCollections: InventoryCollection[];
  };
};
export type PackageFiles = Record<'catalog-inventory.json' | 'contracts.ready.json' | 'assets.ready.json' | 'README.md', string>;
