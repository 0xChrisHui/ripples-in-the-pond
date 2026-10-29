/** 订单状态与运营规则（冻结表 §4）。纯函数，便于确定性测试；DB 层只负责落库。 */

export const PACK_ORDER_STATUSES = [
  'queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming',
  'opened', 'reverted', 'abandoned',
] as const;
export type PackOrderStatus = (typeof PACK_ORDER_STATUSES)[number];

/** 进行中的订单：同一 (chain, score, token) 只允许一个。 */
export const ACTIVE_STATUSES: readonly PackOrderStatus[] = [
  'queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming',
];
export const TERMINAL_STATUSES: readonly PackOrderStatus[] = ['opened', 'reverted', 'abandoned'];

export const OP_DAILY_GLOBAL_LIMIT = 200;
export const OP_DAILY_USER_LIMIT = 3;
export const OP_MAX_ATTEMPTS = 3;
export const WALLET_WAIT_TIMEOUT_MS = 30 * 60_000;

const TRANSITIONS: Record<PackOrderStatus, readonly PackOrderStatus[]> = {
  queued: ['unsent', 'opened', 'abandoned'],
  awaiting_wallet: ['submitted_unknown', 'confirming', 'opened', 'abandoned'],
  unsent: ['submitted_unknown', 'queued', 'opened', 'reverted', 'abandoned'],
  submitted_unknown: ['confirming', 'opened', 'reverted', 'unsent', 'abandoned'],
  confirming: ['opened', 'reverted', 'submitted_unknown'],
  opened: [],
  reverted: [],
  abandoned: [],
};

export function canTransition(from: PackOrderStatus, to: PackOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** 链上 opened 是唯一真值：只要链上已开，任何非终态订单都应收口为 opened。 */
export function settleByChainTruth(status: PackOrderStatus, openedOnChain: boolean): PackOrderStatus {
  if (openedOnChain && !TERMINAL_STATUSES.includes(status)) return 'opened';
  return status;
}

export type AbandonInput = {
  status: PackOrderStatus;
  createdAtMs: number;
  nowMs: number;
  /** 订单绑定的持有人是否仍是链上当前持有人 */
  holderStillOwner: boolean;
  openedOnChain: boolean;
};

/** 进行中订单不得因旧持有人取消或转走 Score 而阻塞新持有人（计划 §6）。 */
export function shouldAbandon(input: AbandonInput): boolean {
  if (input.openedOnChain) return false;
  if (!ACTIVE_STATUSES.includes(input.status)) return false;
  // 已广播或确认中的交易可能仍会成功，先按链上结果收口，不因换人而放弃
  if (input.status === 'submitted_unknown' || input.status === 'confirming') return false;
  if (!input.holderStillOwner) return true;
  if (input.status === 'awaiting_wallet' || input.status === 'unsent') {
    return input.nowMs - input.createdAtMs > WALLET_WAIT_TIMEOUT_MS;
  }
  return false;
}

export type QuotaInput = { globalToday: number; userToday: number };
export type QuotaDecision = { ok: true } | { ok: false; reason: 'GLOBAL_LIMIT' | 'USER_LIMIT' };

/** OP 代付额度；失败的发送也计入（链上只能开一次，但失败交易仍烧 operator Gas）。 */
export function checkOpQuota({ globalToday, userToday }: QuotaInput): QuotaDecision {
  if (globalToday >= OP_DAILY_GLOBAL_LIMIT) return { ok: false, reason: 'GLOBAL_LIMIT' };
  if (userToday >= OP_DAILY_USER_LIMIT) return { ok: false, reason: 'USER_LIMIT' };
  return { ok: true };
}

/** 额度按 UTC 自然日统计。 */
export function utcDayStart(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60_000, 2 ** Math.max(0, attempt) * 60_000);
}
