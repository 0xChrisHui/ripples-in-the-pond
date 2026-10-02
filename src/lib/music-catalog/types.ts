export type Verification = {
  source: string;
  verifiedAt: string | null;
  blockNumber: string | null;
  bytecode: boolean;
  standard: boolean;
  uri: boolean;
  media: boolean;
  reason: string | null;
};
export type ArchiveMint = {
  state: 'not_planned' | 'awaiting_input' | 'pending' | 'confirmed' | 'unknown';
  recipient: string | null;
  amount: string | null;
  txHash: string | null;
  blockNumber: string | null;
  blockHash: string | null;
  logIndex: number | null;
  verifiedAt: string | null;
  proof: string | null;
};
export type OriginalDeployment = {
  chainId: number;
  status: 'undeployed' | 'unverified' | 'ready';
  contractAddress: string | null;
  tokenId: string | null;
  standard: 'ERC1155';
  metadataUri: string | null;
  publicPlaybackUrl: string | null;
  archiveMint: ArchiveMint;
  verification: Verification;
};
export type OriginalTrack = {
  trackId: string;
  displayNumber: number;
  title: string;
  audioArUri: string | null;
  audioSha256: string | null;
  integrityMode: 'canonical_hash' | 'legacy_verified_source' | 'unverified';
  notes: { status: 'absent' | 'draft' | 'final'; text: string | null };
  deployments: OriginalDeployment[];
};
export type MusicCollection = {
  kind: 'original' | 'score' | 'echo';
  chainId: number;
  contractAddress: string;
  standard: 'ERC721' | 'ERC1155';
  metadataMethod: 'uri' | 'tokenURI';
  playbackKind: 'audio' | 'html_decoder';
  enabled: boolean;
  verification: Verification;
  samples?: { tokenId: string; metadataUri: string; publicPlaybackUrl: string; verification: Verification }[];
};
export type MusicCatalog = {
  schemaVersion: 1;
  revision: string;
  environment: 'production';
  tracks: OriginalTrack[];
  collections: MusicCollection[];
};
export type CatalogValidationResult = { valid: boolean; errors: string[] };
