import type { WalletRecipeMode } from '@/src/lib/chain/wallet-recipe-contract';
import type { WalletRecipeEligibility } from '@/src/types/wallet-recipe';

export const WALLET_RECIPE_CONFIRMATIONS = 20n;
export const WALLET_RECIPE_CLAIM_DEADLINE_MS = 20_000;
export const WALLET_RECIPE_RESPONSE_DEADLINE_MS = 25_000;
export const WALLET_RECIPE_RETRY_MINUTES = [1, 2, 5, 15, 30] as const;
export const MINT_ATTEMPT_UNKNOWN_MS = 25 * 60 * 1000;
export const MINT_RECEIPT_TIMEOUT_MS = 30 * 60 * 1000;

export type RuntimeDecision = {
  requestedMode: WalletRecipeMode;
  effectiveMode: WalletRecipeMode;
  reason: 'ready' | 'disabled' | 'misconfigured' | 'permanent_input';
};

export function decideWalletRecipeRuntime(input: {
  mode: WalletRecipeMode;
  modeConfigured: boolean;
  hasPermanentConfig: boolean;
  hasContract: boolean;
}): RuntimeDecision {
  if (!input.modeConfigured) {
    return { requestedMode: input.mode, effectiveMode: 'off', reason: 'misconfigured' };
  }
  if (input.mode === 'off') {
    return { requestedMode: input.mode, effectiveMode: 'off', reason: 'disabled' };
  }
  if (input.mode === 'live' && (!input.hasPermanentConfig || !input.hasContract)) {
    return { requestedMode: input.mode, effectiveMode: 'off', reason: 'permanent_input' };
  }
  return { requestedMode: input.mode, effectiveMode: input.mode, reason: 'ready' };
}

export type DiscoveryCursor = { blockNumber: bigint; logIndex: number };

export function parseDiscoveryCursor(value: string): DiscoveryCursor {
  const match = /^(\d+):(-?\d+)$/.exec(value);
  if (!match) throw new Error('P14 discovery cursor 格式无效');
  const blockNumber = BigInt(match[1]);
  const logIndex = Number(match[2]);
  if (!Number.isSafeInteger(logIndex) || logIndex < -1) {
    throw new Error('P14 discovery cursor logIndex 无效');
  }
  return { blockNumber, logIndex };
}

export function formatDiscoveryCursor(cursor: DiscoveryCursor): string {
  return `${cursor.blockNumber}:${cursor.logIndex}`;
}

export function compareDiscoveryCursor(a: DiscoveryCursor, b: DiscoveryCursor): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.logIndex - b.logIndex;
}

export function classifyEligibility(
  sourceBlock: bigint,
  activationBlock: bigint,
): WalletRecipeEligibility {
  return sourceBlock > activationBlock ? 'eligible' : 'excluded_prelaunch';
}

export function retryDelayMinutes(retryCount: number): number | null {
  return WALLET_RECIPE_RETRY_MINUTES[retryCount] ?? null;
}

export function matchesRuntimeIdentity(input: {
  jobChainId: number;
  runtimeChainId: number;
  jobScoreContract: string;
  runtimeScoreContract: string;
  jobP14Contract: string | null;
  runtimeP14Contract: string;
  requireP14Contract: boolean;
}): boolean {
  return input.jobChainId === input.runtimeChainId
    && input.jobScoreContract.toLowerCase() === input.runtimeScoreContract.toLowerCase()
    && (!input.requireP14Contract
      || input.jobP14Contract?.toLowerCase() === input.runtimeP14Contract.toLowerCase());
}

export type UploadAction = 'upload' | 'wait' | 'verify' | 'reuse' | 'manual_review';

export function decideUploadAction(input: {
  state: 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
  claimed: boolean;
  hasTxId: boolean;
}): UploadAction {
  if (input.state === 'upload_result_unknown') return 'manual_review';
  if (input.state === 'verified') return input.hasTxId ? 'reuse' : 'manual_review';
  if (input.state === 'uploaded') return input.hasTxId ? 'verify' : 'manual_review';
  return input.claimed ? 'upload' : 'wait';
}

export type MintAction =
  | 'broadcast'
  | 'check_receipt'
  | 'wait_attempt'
  | 'manual_review'
  | 'recover_success'
  | 'wait_confirmations'
  | 'success';

export function decideMintAction(input: {
  chainTokenId: bigint;
  chainStateMatches: boolean;
  txHash: string | null;
  attemptedAgeMs: number | null;
  receipt: 'unchecked' | 'pending' | 'reverted' | 'success';
  confirmations: bigint;
}): MintAction {
  if (input.chainTokenId > 0n) {
    return input.chainStateMatches ? 'recover_success' : 'manual_review';
  }
  if (!input.txHash) {
    if (input.attemptedAgeMs === null) return 'broadcast';
    return input.attemptedAgeMs > MINT_ATTEMPT_UNKNOWN_MS
      ? 'manual_review'
      : 'wait_attempt';
  }
  if (input.receipt === 'unchecked') return 'check_receipt';
  if (input.receipt === 'pending') {
    return (input.attemptedAgeMs ?? 0) > MINT_RECEIPT_TIMEOUT_MS
      ? 'manual_review'
      : 'check_receipt';
  }
  if (input.receipt === 'reverted') return 'manual_review';
  return input.confirmations >= WALLET_RECIPE_CONFIRMATIONS
    ? 'success'
    : 'wait_confirmations';
}
