import { getAddress, zeroAddress, type Hex } from 'viem';
import type { publicMaterialOrder } from '../../../lib/material-mint/types';
import type { MaterialVoucher } from './wallet-send';

export type PublicMaterialOrder = ReturnType<typeof publicMaterialOrder>;
const states = ['prepared', 'authorized', 'sending', 'unknown', 'submitted', 'confirming', 'success', 'reverted', 'cancelled'] as const;
export const MATERIAL_STATUS_COPY: Record<PublicMaterialOrder['status'], string> = {
  prepared: '待钱包确认', authorized: '待钱包确认', sending: '交易正在发送，请勿重复操作',
  unknown: '交易结果待核对，请勿再次发送', submitted: '已登记交易，等待链上确认',
  confirming: '等待足够的链上确认', success: '原曲领取已确认',
  reverted: '交易未成功，可重新检查后发送', cancelled: '订单已取消',
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('原曲订单响应无效');
  return value as Record<string, unknown>;
}
function text(value: unknown) { if (typeof value !== 'string') throw Error('原曲订单字段无效'); return value; }
export function materialOrderId(value: unknown): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || /^0x0+$/.test(value)) throw Error('原曲订单标识无效');
  return value as Hex;
}
function address(value: unknown) {
  const parsed = getAddress(text(value)); if (parsed === zeroAddress) throw Error('原曲订单地址无效'); return parsed;
}
export function parseMaterialOrder(value: unknown): PublicMaterialOrder {
  const r = record(value), status = text(r.status), trackId = text(r.trackId), tokenId = text(r.tokenId);
  if (!states.some(s => s === status) || !/^[0-9a-f-]{36}$/.test(trackId)
    || !/^[1-9][0-9]*$/.test(tokenId) || BigInt(tokenId) >= 2n ** 256n || r.amount !== 1
    || ![1, 11155111].includes(Number(r.chainId)) || typeof r.chainId !== 'number'
    || typeof r.version !== 'number' || !Number.isSafeInteger(r.version) || r.version < 0
    || !/^[0-9a-f]{64}$/.test(text(r.catalogRevision)) || !/^ar:\/\/[a-zA-Z0-9_-]{43}$/.test(text(r.metadataUri))) {
    throw Error('原曲订单身份或状态无效');
  }
  return { orderId: materialOrderId(r.orderId), trackId, chainId: r.chainId as 1 | 11155111,
    contractAddress: address(r.contractAddress), tokenId, recipientAddress: address(r.recipientAddress), amount: 1,
    catalogRevision: text(r.catalogRevision), metadataUri: text(r.metadataUri), status: status as PublicMaterialOrder['status'],
    version: r.version, txHash: r.txHash === null ? null : materialOrderId(r.txHash),
    digest: r.digest === null ? null : materialOrderId(r.digest),
    recovery: ['sending', 'unknown', 'submitted', 'confirming'].includes(status) ? 'check_existing_order' : 'none' };
}
export function assertSameMaterialOrder(a: PublicMaterialOrder, b: PublicMaterialOrder) {
  if (a.orderId !== b.orderId || a.trackId !== b.trackId || a.chainId !== b.chainId || a.tokenId !== b.tokenId
    || a.contractAddress !== b.contractAddress || a.recipientAddress !== b.recipientAddress
    || a.metadataUri !== b.metadataUri || a.catalogRevision !== b.catalogRevision || b.amount !== 1) throw Error('响应与冻结订单不一致');
}
export function parseMaterialVoucher(value: unknown): MaterialVoucher {
  const r = record(value), order = parseMaterialOrder(r), a = record(r.authorization);
  if (!order.digest || !/^0x[0-9a-fA-F]{130}$/.test(text(r.signature))
    || materialOrderId(a.orderId) !== order.orderId || text(a.tokenId) !== order.tokenId || a.amount !== '1'
    || address(a.recipient) !== order.recipientAddress || !/^[1-9][0-9]*$/.test(text(a.deadline))) throw Error('凭证与冻结订单不一致');
  return { ...order, digest: order.digest, authorizer: address(r.authorizer), signature: text(r.signature) as Hex,
    authorization: { orderId: order.orderId, tokenId: order.tokenId, amount: '1', recipient: order.recipientAddress,
      tokenURIHash: materialOrderId(a.tokenURIHash), deadline: text(a.deadline) } };
}
export function canSendMaterialOrder(order: PublicMaterialOrder) {
  return ['prepared', 'authorized', 'reverted'].includes(order.status);
}
