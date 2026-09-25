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
  assetStage: 'events' | 'package' | 'metadata' | 'complete';
};

export function formatGasUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export const ASSET_STAGE_COPY: Record<PublicOrder['assetStage'], { title: string; detail: string }> = {
  events: { title: '正在永久保存演奏事件 · 1/3', detail: '后台正在固定你的演奏数据，页面会自动更新。' },
  package: { title: '正在生成永久作品包 · 2/3', detail: '演奏事件已保存，正在组合声音与播放器资源。' },
  metadata: { title: '正在固定作品身份 · 3/3', detail: '最后一步完成后会立即打开钱包确认入口。' },
  complete: { title: '永久素材准备完成', detail: '正在切换到钱包确认。' },
};

export const SNAPSHOT_PENDING_COPY = {
  title: '链上铸造成功',
  detail: '正在等待永久资源同步到可读取网关，完成后会自动开放作品。无需再次支付 Gas。',
};

export const STATUS_COPY: Record<PublicOrder['status'], { title: string; detail: string }> = {
  preparing_assets: { title: '正在准备并永久保存作品', detail: '素材写入后不可删除；这里可以安全关闭，后台会继续。' },
  ready_to_sign: { title: '确认铸造费用', detail: '还没有扣除费用；确认美元 Gas 预估后，再打开钱包。' },
  submitted: { title: '交易已提交', detail: '不要重复发送。即使关闭页面，后台仍会继续核验。' },
  confirming: { title: '等待链上确认', detail: '合约已看到作品，达到确认数后会开放永久页面。' },
  success: { title: '铸造完成', detail: '永久作品与链上身份已完成一致性核验。' },
  expired: { title: '授权已过期', detail: '永久素材仍然有效，可以生成新授权，不需要重新上传。' },
  failed: { title: '交易已明确失败', detail: '只有完成链上清查后，系统才允许重新选择铸造方式。' },
  manual_review: { title: '铸造结果需要核对', detail: '系统已暂停重发，请保留当前交易并等待核对，避免重复支付 Gas。' },
};
