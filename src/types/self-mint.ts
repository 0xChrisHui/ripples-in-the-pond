import type { Address, Hex } from 'viem';
import type { SupportedChainId } from '@/src/lib/chain/multichain/registry';

export const SELF_MINT_STATUSES = [
  'preparing_assets', 'ready_to_sign', 'submitted', 'confirming',
  'success', 'expired', 'failed', 'manual_review',
] as const;

export type SelfMintStatus = typeof SELF_MINT_STATUSES[number];

export interface ScoreSelfMintOrder {
  orderId: Hex;
  pendingScoreId: string;
  chainId: Extract<SupportedChainId, 1 | 11155111>;
  scoreContract: Address;
  tokenId: string;
  recipientAddress: Address;
  tokenUri: string | null;
  authorizationDigest: Hex | null;
  txHash: Hex | null;
  replacementTxHash: Hex | null;
  blockNumber: string | null;
  confirmedAt: string | null;
  status: SelfMintStatus;
  retryable: boolean;
  failureCode: string | null;
  sendAttempted: boolean;
}
