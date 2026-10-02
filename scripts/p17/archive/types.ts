import type { ArchiveMint } from '../../../src/lib/music-catalog/types';
import type { Address, Hex } from 'viem';

export type ArchiveState = 'planned' | 'checked' | 'attempted' | 'submitted' | 'confirming'
  | 'confirmed' | 'unknown' | 'failed' | 'awaiting_input';
export type ArchiveRecipient = { address: Address; approvalRef: string };
export type ArchiveItem = {
  trackId: string; displayNumber: number; chainId: number;
  contractAddress: Address | null; tokenId: string | null; metadataUri: string | null;
  recipient: Address | null; amount: '1'; approvalRef: string | null;
  operationId: Hex | null; operation: 'disabled'; feeLimitWei: '0'; pending: string[];
  state: ArchiveState; archiveMint: ArchiveMint;
  sender?: Address; nonce?: string; calldataHash?: Hex; txHashes?: Hex[];
  attemptedAt?: string; inspection?: { status: string; reason: string; checkedAt: string; balance?: string };
};
export type ArchivePlan = {
  schemaVersion: 2; runId: string; revision: string; sourceSha: string;
  scope: string; feeLimitWei: '0'; planHash: Hex; items: ArchiveItem[];
};
