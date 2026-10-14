import type { Hex } from 'viem';

export type PublicOrder = {
  orderId: Hex;
  chainId: 1 | 11155111;
  scoreContract: string;
  tokenId: string;
  recipientAddress: string;
  tokenUri: string | null;
  txHash: Hex | null;
  replacementTxHash: Hex | null;
  failedTxHash: Hex | null;
  authorizationDigest: Hex | null;
  sendAttempted: boolean;
  blockNumber: string | null;
  confirmedAt: string | null;
  status: 'preparing_assets' | 'ready_to_sign' | 'submitted' | 'confirming'
    | 'success' | 'expired' | 'failed' | 'manual_review';
  retryable: boolean;
  failureCode: string | null;
  canContinue: boolean;
  assetStage: 'events' | 'package' | 'metadata' | 'complete';
};

export function formatGasUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

/** 当前该显示哪组标题/说明；文案在词典 selfMint.copy.<key>.title / .detail（P19） */
export type SelfMintCopyKey = 'busy' | `asset.${PublicOrder['assetStage']}` | 'snapshotPending'
  | `status.${PublicOrder['status']}`;

export function selfMintCopyKey(order: PublicOrder, busy: boolean): SelfMintCopyKey {
  if (busy && order.status === 'ready_to_sign') return 'busy';
  if (order.status === 'preparing_assets') return `asset.${order.assetStage}`;
  if (order.failureCode === 'SNAPSHOT_PENDING') return 'snapshotPending';
  if (order.status === 'ready_to_sign' && order.sendAttempted) return 'status.manual_review';
  return `status.${order.status}`;
}
