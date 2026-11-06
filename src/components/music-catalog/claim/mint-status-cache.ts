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
  op.clear();
  eth.clear();
  bump();
}

export type MintIdentity = { userId: string; wallet: string | null; getToken: () => Promise<string | null> };
const REFRESH_COOLDOWN_MS = 8000;
let inflight: Promise<void> | null = null;
let lastAttempt = 0;

/**
 * 批量加载本人全部原曲状态（一次请求）。并发时复用同一个请求；非强制调用在冷却期内不重复请求（防止失败时反复打服务端）。
 * 写入时对所有相关曲目都给出确定结果（未收藏 = null），因此写完之后不会再出现"未知"。
 */
export function loadMintStatus(identity: MintIdentity, force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastAttempt < REFRESH_COOLDOWN_MS) return Promise.resolve();
  lastAttempt = Date.now();
  inflight = (async () => {
    try {
      const token = await identity.getToken();
      if (!token) return;
      const response = await fetchWithAuth('/api/material-mint/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) return;
      const body = await response.json() as { op: Record<string, MintStatus | null>; orders: PublicMaterialOrder[] };
      for (const [trackId, row] of Object.entries(body.op)) opCache.set(identity.userId, trackId, row ?? { status: null });
      if (identity.wallet) {
        const wallet = identity.wallet;
        for (const { track } of listReadyOriginals()) {
          const deployment = getOriginalDeployment(track.trackId, 1);
          if (deployment?.status !== 'ready' || !deployment.contractAddress || !deployment.metadataUri) continue;
          const existing = body.orders.find((item) => item.chainId === 1 && item.tokenId === deployment.tokenId
            && item.recipientAddress === wallet && item.status !== 'cancelled') ?? null;
          ethCache.set(wallet, track.trackId, existing);
        }
      }
    } catch { /* 网络失败：保持未知，下次进入时再查 */ }
    finally { inflight = null; }
  })();
  return inflight;
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
