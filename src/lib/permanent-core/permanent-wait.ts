import type { ScoreFailureKind, ScoreMintQueueRow } from '@/src/types/score-mint';

const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 15 * 60_000;
const MAX_WAIT_MS = 2 * 60 * 60_000;
const MAX_RETRY = 3;

/** 仅网关暂不可读属于等待，身份冲突不能使用此类型。 */
export class PermanentResourcePendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentResourcePendingError';
  }
}

export function permanentWaitDelayMs(ageMs: number): number {
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, ageMs * 0.5));
}

export function isPermanentWaitExpired(ageMs: number): boolean {
  return !Number.isFinite(ageMs) || ageMs >= MAX_WAIT_MS;
}

type QueueErrorUpdate = Partial<Pick<ScoreMintQueueRow,
  'status' | 'retry_count' | 'last_error' | 'locked_by' | 'lease_expires_at' | 'updated_at'
>> & { failure_kind?: ScoreFailureKind | null };

/** 注入时钟与首个上传意图时间；不能用每次 claim 都会刷新的 updated_at 计算年龄。 */
export function scoreQueueErrorDecision(
  error: unknown,
  row: Pick<ScoreMintQueueRow, 'retry_count' | 'created_at'>,
  nowMs: number,
  uploadStartedAt: string | null = null,
): { waiting: boolean; update: QueueErrorUpdate } {
  const message = error instanceof Error ? error.message : String(error);
  const ageMs = nowMs - Date.parse(uploadStartedAt ?? row.created_at);
  const critical = message.startsWith('CRITICAL');
  const waiting = !critical && error instanceof PermanentResourcePendingError && !isPermanentWaitExpired(ageMs);
  const delayMs = permanentWaitDelayMs(ageMs);
  const update: QueueErrorUpdate = {
    last_error: (waiting
      ? `等待永久资源传播，${Math.round(delayMs / 1000)} 秒后重试：${message}`.replace(/[\r\n]+/g, ' ')
      : message).slice(0, 500),
    locked_by: null,
    lease_expires_at: waiting ? new Date(nowMs + delayMs).toISOString() : null,
    updated_at: new Date(nowMs).toISOString(),
  };
  if (!waiting) {
    update.retry_count = critical ? row.retry_count : row.retry_count + 1;
    if (critical || update.retry_count >= MAX_RETRY) {
      update.status = 'failed';
      update.failure_kind = critical ? 'manual_review' : 'safe_retry';
    }
  }
  return { waiting, update };
}
