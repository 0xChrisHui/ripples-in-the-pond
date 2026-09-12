import type {
  WalletRecipeFailureKind,
  WalletRecipeMetadataUploadState,
  WalletRecipeQueueStatus,
} from '@/src/types/wallet-recipe';

export type WalletRecipeQueueRow = {
  id: string;
  chain_id: number;
  source_score_contract: string;
  p14_contract: string | null;
  origin_wallet: `0x${string}`;
  origin_wallet_key: string;
  eligibility: 'eligible';
  source_score_queue_id: string | null;
  source_score_token_id: number;
  source_score_tx_hash: string;
  source_score_log_index: number;
  source_score_block: number;
  recipe_version: 1;
  recipe: string;
  recipe_hash: string;
  image_ar_tx_id: string | null;
  metadata_ar_tx_id: string | null;
  metadata_sha256: string | null;
  metadata_upload_state: WalletRecipeMetadataUploadState;
  token_uri: string | null;
  token_id: number | null;
  tx_hash: string | null;
  mint_attempted_at: string | null;
  status: WalletRecipeQueueStatus;
  retry_count: number;
  failure_kind: WalletRecipeFailureKind | null;
  last_error: string | null;
  alerted_at: string | null;
};

export type PipelineStepResult = {
  status: WalletRecipeQueueStatus;
  detail: string;
  failureKind?: WalletRecipeFailureKind;
};

export class PipelineStepError extends Error {
  constructor(
    message: string,
    readonly failureKind: WalletRecipeFailureKind,
  ) {
    super(message);
    this.name = 'PipelineStepError';
  }
}

export function asPipelineError(error: unknown): PipelineStepError {
  if (error instanceof PipelineStepError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new PipelineStepError(message, 'safe_retry');
}

export function pipelineFailureHttpStatus(kind: WalletRecipeFailureKind): 500 | 503 {
  return kind === 'transient' || kind === 'safe_retry' ? 503 : 500;
}

export function isLeaseRow(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === 'object' && 'id' in value);
}
