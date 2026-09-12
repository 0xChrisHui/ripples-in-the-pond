import type {
  WalletRecipeHealth,
  WalletRecipeStatusDistribution,
} from '@/src/types/wallet-recipe-health';
import type { WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';
import { SOURCE_CHUNK_SIZE, SOURCE_MAX_BATCHES } from '@/src/features/source-index/source-policy';

export const WALLET_RECIPE_STATUSES: readonly WalletRecipeQueueStatus[] = [
  'excluded_prelaunch',
  'pending',
  'preparing_media',
  'uploading_metadata',
  'minting_onchain',
  'confirming_onchain',
  'safe_retry',
  'manual_review',
  'success',
];

const ACTIVE_STATUSES: readonly WalletRecipeQueueStatus[] = [
  'pending',
  'preparing_media',
  'uploading_metadata',
  'minting_onchain',
  'confirming_onchain',
  'safe_retry',
];

export function summarizeQueue(
  distribution: WalletRecipeStatusDistribution,
  oldestCreatedAt: string | null,
  uploadResultUnknown: number,
  nowMs: number,
): WalletRecipeHealth['queue'] {
  const active = ACTIVE_STATUSES.reduce((sum, status) => sum + distribution[status], 0);
  const oldestMs = oldestCreatedAt ? Date.parse(oldestCreatedAt) : Number.NaN;
  return {
    distribution,
    active,
    failed: distribution.safe_retry + distribution.manual_review,
    manualReview: distribution.manual_review,
    success: distribution.success,
    excluded: distribution.excluded_prelaunch,
    oldestActiveAgeSeconds: Number.isFinite(oldestMs)
      ? Math.max(0, Math.floor((nowMs - oldestMs) / 1000))
      : null,
    uploadResultUnknown,
  };
}

export function blockLag(target: bigint | null, cursor: bigint | null): string | null {
  return target === null || cursor === null ? null : (target - cursor).toString();
}

export function parseCursorBlock(cursor: string | null): bigint | null {
  const match = cursor ? /^(\d+):-?\d+$/.exec(cursor) : null;
  return match ? BigInt(match[1]) : null;
}

export function isCronStale(lastSuccessAt: string | null, nowMs: number): boolean {
  if (!lastSuccessAt) return true;
  const timestamp = Date.parse(lastSuccessAt);
  return !Number.isFinite(timestamp) || nowMs - timestamp > 3 * 60 * 1000;
}

export function collectHealthAlerts(health: Omit<WalletRecipeHealth, 'alerts'>): string[] {
  const alerts: string[] = [];
  if (!health.modeConfigured) alerts.push('mode_misconfigured');
  if (!health.database.tableReachable || !health.database.rpcReachable) alerts.push('database_unreachable');
  if (health.walletRecipeMode !== 'off' && health.cronStale) alerts.push('cron_stale');
  if (health.sourceSyncStale) alerts.push('source_cron_stale');
  if (health.queue.manualReview > 0) alerts.push('manual_review');
  if (health.queue.uploadResultUnknown > 0) alerts.push('upload_result_unknown');
  if ((health.queue.oldestActiveAgeSeconds ?? 0) > 3 * 60) alerts.push('active_queue_stale');
  const sourceLag = health.cursors.sourceToSafeHeadBlocks === null
    ? null : BigInt(health.cursors.sourceToSafeHeadBlocks);
  if (sourceLag !== null && sourceLag < 0n) alerts.push('source_index_ahead_of_safe_head');
  if (sourceLag !== null && sourceLag > 0n
    && (health.sourceSyncStale || sourceLag > SOURCE_CHUNK_SIZE * BigInt(SOURCE_MAX_BATCHES))) {
    alerts.push('source_index_lagging');
  }
  const discoveryBlock = parseCursorBlock(health.lastDiscoveryCursor);
  const sourceBlock = health.sourceChainCursor && /^\d+$/.test(health.sourceChainCursor)
    ? BigInt(health.sourceChainCursor) : null;
  if (discoveryBlock !== null && sourceBlock !== null && discoveryBlock > sourceBlock) {
    alerts.push('discovery_cursor_ahead_of_source');
  }
  if (health.expectedActivationMatches === false) alerts.push('activation_mismatch');
  if (health.walletRecipeMode === 'live' && !health.contract.codeExists) alerts.push('contract_code_missing');
  if (health.walletRecipeMode === 'live' && health.contract.minterRole !== true) alerts.push('minter_role_missing');
  if (health.walletRecipeMode === 'live'
    && !Object.values(health.permanentInputs).every(Boolean)) alerts.push('permanent_inputs_missing');
  if (health.walletRecipeMode === 'live' && !health.configured) alerts.push('live_fail_closed');
  return alerts;
}
