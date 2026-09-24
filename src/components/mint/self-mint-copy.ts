import type { Hex } from 'viem';

export type PublicOrder = {
  orderId: Hex;
  chainId: 1 | 11155111;
  scoreContract: string;
  tokenId: string;
  recipientAddress: string;
  tokenUri: string | null;
  txHash: Hex | null;
  replacementTxHash: Hex | null;
  failedTxHash: Hex | null;
  authorizationDigest: Hex | null;
  sendAttempted: boolean;
  blockNumber: string | null;
  confirmedAt: string | null;
  status: 'preparing_assets' | 'ready_to_sign' | 'submitted' | 'confirming'
    | 'success' | 'expired' | 'failed' | 'manual_review';
  retryable: boolean;
  failureCode: string | null;
  canContinue: boolean;
};

export const STATUS_COPY: Record<PublicOrder['status'], { title: string; detail: string }> = {
  preparing_assets: { title: '正在准备并永久保存作品', detail: '素材写入后不可删除；这里可以安全关闭，后台会继续。' },
  ready_to_sign: { title: '等待钱包确认', detail: '还没有扣除 Gas；点击后会先模拟交易，再打开钱包。' },
  submitted: { title: '交易已提交', detail: '不要重复发送。即使关闭页面，后台仍会继续核验。' },
  confirming: { title: '等待链上确认', detail: '合约已看到作品，达到确认数后会开放永久页面。' },
  success: { title: '铸造完成', detail: '永久作品与链上身份已完成一致性核验。' },
  expired: { title: '授权已过期', detail: '永久素材仍然有效，可以生成新授权，不需要重新上传。' },
  failed: { title: '交易已明确失败', detail: '只有完成链上清查后，系统才允许重新选择铸造方式。' },
  manual_review: { title: '交易结果暂时无法确认', detail: '交易哈希未被后台确认，系统已暂停重发。请先核对钱包活动，避免重复支付 Gas。' },
};
