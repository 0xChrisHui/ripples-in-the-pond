import type { PublicMaterialOrder } from '../../../features/material-catalog/mint/order-model';

export type OpErrorKey = 'statusUnavailable' | 'notReady' | 'resultUnknown';
/** error 为服务端原文（中文模式照旧显示）；errorKey 为本地文案 */
export type MintStatus = { status?: string | null; txHash?: string | null; recipientAddress?: string; recipientFrozen?: boolean;
  error?: string; errorKey?: OpErrorKey; code?: string; needsReview?: boolean; alreadyMinted?: boolean };

/**
 * 原曲铸造状态的内存缓存（按身份 + 曲目）。
 * MintStatusPrefetch 在登录后后台预取；面板挂载时同步读取，首帧即是真实状态，之后仍会静默刷新。
 * 键里带身份（OP 用 userId，以太坊用钱包地址），切换账号不会串数据；登出时整体清空。
 */
const op = new Map<string, MintStatus>();
const eth = new Map<string, PublicMaterialOrder | null>();

const opKey = (userId: string, trackId: string) => `${userId}|${trackId}`;
const ethKey = (wallet: string, trackId: string) => `${wallet.toLowerCase()}|${trackId}`;

export const opCache = {
  get: (userId: string, trackId: string) => op.get(opKey(userId, trackId)),
  set: (userId: string, trackId: string, value: MintStatus) => { op.set(opKey(userId, trackId), value); },
};

/** 返回 undefined = 未查过；null = 查过且没有已有订单。 */
export const ethCache = {
  get: (wallet: string, trackId: string) => eth.get(ethKey(wallet, trackId)),
  set: (wallet: string, trackId: string, value: PublicMaterialOrder | null) => { eth.set(ethKey(wallet, trackId), value); },
};

export function clearMintCache(): void {
  op.clear();
  eth.clear();
}
