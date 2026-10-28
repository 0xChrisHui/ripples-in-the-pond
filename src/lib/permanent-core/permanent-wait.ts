import type { ScoreFailureKind, ScoreMintQueueRow } from '@/src/types/score-mint';

const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 15 * 60_000;
const MAX_WAIT_MS = 2 * 60 * 60_000;
const MAX_RETRY = 3;

/** 仅网关暂不可读属于等待，身份冲突不能使用此类型。 */
export class PermanentResourcePendingError extends Error {
  readonly arTxIds: string[];

  constructor(message: string, arTxIds: readonly string[] = []) {
    super(message);
    this.name = 'PermanentResourcePendingError';
    this.arTxIds = [...new Set(arTxIds)];
  }
}

/** 等齐所有资源，避免先返回的传播等待掩盖后到的身份冲突。 */
export async function settleAttestations<T extends readonly unknown[]>(
  promises: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const settled = await Promise.allSettled(promises);
  const failures = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
  const errors = failures.filter((item) => !(item.reason instanceof PermanentResourcePendingError));
  if (errors.length) {
    const critical = errors.find((item) => (
      item.reason instanceof Error ? item.reason.message : String(item.reason)
    ).startsWith('CRITICAL'));
    throw (critical ?? errors[0]).reason;
  }
  if (failures.length) {
    const pending = failures.map((item) => item.reason as PermanentResourcePendingError);
    throw new PermanentResourcePendingError(
      pending.map((error) => error.message).join('; '), pending.flatMap((error) => error.arTxIds),
    );
  }
  return settled.map((item) => (item as PromiseFulfilledResult<unknown>).value) as {
    -readonly [K in keyof T]: Awaited<T[K]>
  };
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

type QueueErrorRow = Pick<ScoreMintQueueRow, 'retry_count' | 'created_at'
  | 'events_upload_state' | 'package_upload_state' | 'metadata_upload_state'>;

function permanentWaitAgeMs(uploadStartedAt: string | null, createdAt: string, nowMs: number): number {
  const usable = (time: number) => Number.isFinite(time) && time <= nowMs + 60_000;
  const uploaded = Date.parse(uploadStartedAt ?? '');
  const anchor = usable(uploaded) ? uploaded : Date.parse(createdAt);
  // 容忍一分钟时钟偏差但不产生负年龄；两种时间均异常时必须耗用普通重试。
  return usable(anchor) ? Math.max(0, nowMs - anchor) : Number.NaN;
}

/** 注入认领时的上传状态、时钟及当前不可读资源的上传时间，禁止用 updated_at 续期。 */
export function scoreQueueErrorDecision(
  error: unknown,
  row: QueueErrorRow,
  nowMs: number,
  uploadStartedAt: string | null = null,
): { waiting: boolean; update: QueueErrorUpdate } {
  const message = error instanceof Error ? error.message : String(error);
  const ageMs = permanentWaitAgeMs(uploadStartedAt, row.created_at, nowMs);
  const critical = message.startsWith('CRITICAL');
  const uploadUnknown = [row.events_upload_state, row.package_upload_state, row.metadata_upload_state]
    .some((state) => state === 'uploading' || state === 'upload_result_unknown');
  const waiting = !critical && !uploadUnknown
    && error instanceof PermanentResourcePendingError && !isPermanentWaitExpired(ageMs);
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
