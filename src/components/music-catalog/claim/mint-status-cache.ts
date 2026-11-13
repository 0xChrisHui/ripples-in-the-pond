import { canSendMaterialOrder, type PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';
import { fetchWithAuth } from '../../../lib/fetch-with-auth';
import { getOriginalDeployment, listReadyOriginals } from '../../../lib/music-catalog/asset-registry';

export type OpErrorKey = 'statusUnavailable' | 'notReady' | 'resultUnknown';
/** error 为服务端原文（中文模式照旧显示）；errorKey 为本地文案 */
export type MintStatus = { status?: string | null; txHash?: string | null; recipientAddress?: string; recipientFrozen?: boolean;
  error?: string; errorKey?: OpErrorKey; code?: string; needsReview?: boolean; alreadyMinted?: boolean };

/**
 * 原曲铸造状态的内存缓存（按身份 + 曲目）。undefined = 还没查过；面板遇到它只显示禁用按钮，不显示任何"核对中"文字。
 * 键带身份（OP 用 userId，以太坊用钱包地址），切换账号不会串数据；登出时整体清空。
 * 一次批量请求（/api/material-mint/status）同时写满所有曲目，写入时通知订阅者刷新界面。
 */
const op = new Map<string, MintStatus>();
const eth = new Map<string, PublicMaterialOrder | null>();
const listeners = new Set<() => void>();
let version = 0;
function bump(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeMintCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function mintCacheVersion(): number { return version; }

const opKey = (userId: string, trackId: string) => `${userId}|${trackId}`;
const ethKey = (wallet: string, trackId: string) => `${wallet.toLowerCase()}|${trackId}`;

export const opCache = {
  get: (userId: string, trackId: string) => op.get(opKey(userId, trackId)),
  set: (userId: string, trackId: string, value: MintStatus) => { op.set(opKey(userId, trackId), value); bump(); },
};

/** 返回 undefined = 未查过；null = 查过且没有已有订单。 */
export const ethCache = {
  get: (wallet: string, trackId: string) => eth.get(ethKey(wallet, trackId)),
  set: (wallet: string, trackId: string, value: PublicMaterialOrder | null) => { eth.set(ethKey(wallet, trackId), value); bump(); },
};

export function clearMintCache(): void {
  resetRequests();
  op.clear();
  eth.clear();
  bump();
}

export type MintIdentity = { userId: string; wallet: string | null; getToken: () => Promise<string | null> };
const identityKey = (id: MintIdentity) => id.userId + '|' + (id.wallet ?? '').toLowerCase();
type Attempt = { key: string; last: number; retried: boolean; error: boolean; next: number;
  inflight?: Promise<void>; followup?: boolean; timer?: ReturnType<typeof setTimeout> };
let current: Attempt | undefined;

export function mintReadFailed(identity: MintIdentity | null) {
  return Boolean(identity && current?.key === identityKey(identity) && current.error);
}

function resetRequests() {
  if (current?.timer) clearTimeout(current.timer);
  current = undefined;
}

export function loadMintStatus(identity: MintIdentity, force = false): Promise<void> {
  const key = identityKey(identity);
  if (current?.key !== key) {
    resetRequests();
    current = { key, last: 0, retried: false, error: false, next: 0 };
  }
  const state = current;
  if (state.inflight) {
    if (force) state.followup = true;
    return state.inflight;
  }
  if (!force && state.retried && state.error) return Promise.resolve();
  if (!force && (Date.now() < state.next || Date.now() - state.last < 5000)) return Promise.resolve();
  if (state.timer) clearTimeout(state.timer);
  state.last = Date.now();
  const retry = (delay: number) => {
    if (current !== state) return;
    state.error = true;
    state.next = Date.now() + delay;
    bump();
    if (state.retried) return;
    state.retried = true;
    state.timer = setTimeout(() => { if (current === state) void loadMintStatus(identity, true); }, delay);
  };
  state.inflight = (async () => {
    try {
      const token = await identity.getToken();
      if (!token || current !== state) return;
      const response = await fetchWithAuth('/api/material-mint/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (current !== state) return;
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          const hint = response.headers.get('Retry-After');
          const seconds = hint && /^\d+$/.test(hint) ? Number(hint) * 1000 : Date.parse(hint ?? '') - Date.now();
          retry(Number.isFinite(seconds) ? Math.max(1000, seconds) : 15000);
        } else { state.error = true; bump(); }
        return;
      }
      const body = await response.json() as { op: Record<string, MintStatus | null>; orders: PublicMaterialOrder[] };
      if (current !== state) return;
      state.error = false;
      state.retried = false;
      state.next = 0;
      for (const [trackId, row] of Object.entries(body.op)) opCache.set(identity.userId, trackId, row ?? { status: null });
      if (identity.wallet) {
        const wallet = identity.wallet.toLowerCase();
        for (const { track } of listReadyOriginals()) {
          const deployment = getOriginalDeployment(track.trackId, 1);
          if (deployment?.status !== 'ready' || !deployment.contractAddress || !deployment.metadataUri) continue;
          const existing = body.orders.find(item => item.chainId === 1 && item.tokenId === deployment.tokenId
            && item.recipientAddress.toLowerCase() === wallet && item.status !== 'cancelled') ?? null;
          ethCache.set(wallet, track.trackId, existing);
        }
      }
    } catch { retry(15000); }
    finally {
      state.inflight = undefined;
      if (current === state && state.followup) {
        state.followup = false;
        await loadMintStatus(identity, true);
      }
    }
  })();
  return state.inflight;
}

/** 以太坊订单是否已确认完成（与面板"已收藏"判断一致）。 */
export function isFinishedOrder(order: PublicMaterialOrder | null | undefined): boolean {
  return Boolean(order && !canSendMaterialOrder(order));
}

/** 订单是否还在链上推进中（已发出、待确认）：此时面板应保持可见，用户才能看到进度。 */
export function isOrderInFlight(order: PublicMaterialOrder | null | undefined): boolean {
  return Boolean(order && ['sending', 'unknown', 'submitted', 'confirming'].includes(order.status));
}

/**
 * 铸造活动：某首曲目正在铸造（等钱包 / 建单 / 签名 / 订单待确认）。
 * /lens 面板据此"钉住"该曲目——MetaMask 是独立窗口，鼠标一离开页面悬停就失效，面板不能因此撤下。
 * 结束后再保留 LINGER_MS，让用户看到最终结果。
 */
const LINGER_MS = 8000;
const active = new Map<string, number>(); // trackId → 结束时刻（0 = 仍在进行）
export function setMintActivity(trackId: string, on: boolean): void {
  if (on) { active.set(trackId, 0); return; }
  if (active.get(trackId) === 0) active.set(trackId, Date.now());
}
/** 当前应钉住的曲目：进行中的优先，否则取结束后 LINGER_MS 内最近的一个。 */
export function mintPinnedTrackId(now = Date.now()): string | null {
  let latest: string | null = null, latestEnd = 0;
  for (const [trackId, endedAt] of active) {
    if (endedAt === 0) return trackId;
    if (now - endedAt > LINGER_MS) { active.delete(trackId); continue; }
    if (endedAt > latestEnd) { latest = trackId; latestEnd = endedAt; }
  }
  return latest;
}
