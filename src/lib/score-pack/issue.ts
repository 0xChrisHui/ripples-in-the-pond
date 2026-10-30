import 'server-only';

import { getAddress, type Address } from 'viem';
import { getActiveScoreSnapshot } from '@/src/data/score/snapshot-source';
import { getConfiguredScoreAddress } from '@/src/lib/chain/multichain/registry';
import { supabaseAdmin } from '@/src/lib/supabase';
import { readOpened, readScoreOwner } from './chain';
import { getPackChainConfig, type PackChainConfig } from './contract';
import { derivePack, PackDeriveError, type DerivedPack } from './derive';
import { PackOrderError, reserveOrder, type PackOrderRow } from './orders';
import { buildVoucher, signVoucher, voucherToJson } from './voucher';

export type IssueErrorCode =
  | 'PACK_DISABLED' | 'NOT_ENABLED' | 'WRONG_CONTRACT' | 'NOT_HOLDER' | 'ALREADY_OPENED' | 'NO_SNAPSHOT'
  | 'MISSING_ASSETS' | 'EMPTY_PACK' | 'TOO_MANY_SOUNDS' | 'GLOBAL_LIMIT' | 'USER_LIMIT'
  | 'ACTIVE_ORDER_EXISTS';

export class PackIssueError extends Error {
  constructor(readonly code: IssueErrorCode, readonly status: number, readonly detail?: string[]) {
    super(code);
  }
}

export type PackRequest = {
  chainId: number;
  scoreContract: string;
  tokenId: bigint;
  userId: string;
  /** 调用者声称的持有人；服务端仍以链上 ownerOf 为准 */
  holder: Address;
  mode: PackOrderRow['mode'];
};

type Checked = { cfg: PackChainConfig; score: Address; pack: DerivedPack };

/** 内测名单：P22_ALLOWED_USER_IDS 为 '*' 表示全员开放，否则是逗号分隔的用户 id；未配置视为无人可用。 */
export function isPackEnabledFor(userId: string): boolean {
  const raw = (process.env.P22_ALLOWED_USER_IDS ?? '').trim();
  if (raw === '*') return true;
  return raw.split(',').map((item) => item.trim()).filter(Boolean).includes(userId);
}

/** 资格检查：链上真值（持有人、是否已开）→ 永久 snapshot 派生素材清单。清单永远由服务端派生。 */
export async function checkEligibility(req: PackRequest): Promise<Checked> {
  if (!isPackEnabledFor(req.userId)) throw new PackIssueError('NOT_ENABLED', 403);
  const cfg = getPackChainConfig(req.chainId);
  if (!cfg) throw new PackIssueError('PACK_DISABLED', 404);
  const score = getAddress(req.scoreContract);
  if (score !== getConfiguredScoreAddress(req.chainId)) throw new PackIssueError('WRONG_CONTRACT', 400);

  const owner = await readScoreOwner(req.chainId, score, req.tokenId);
  if (!owner || owner !== getAddress(req.holder)) throw new PackIssueError('NOT_HOLDER', 403);
  if (await readOpened(cfg, req.tokenId)) throw new PackIssueError('ALREADY_OPENED', 409);

  const snapshot = await getActiveScoreSnapshot(Number(req.tokenId), { chainId: req.chainId, contract: score });
  if (!snapshot) throw new PackIssueError('NO_SNAPSHOT', 409);
  try {
    return { cfg, score, pack: derivePack(snapshot.playbackBootstrap) };
  } catch (error) {
    if (error instanceof PackDeriveError) {
      throw new PackIssueError(error.code, error.code === 'MISSING_ASSETS' ? 409 : 422, error.missing);
    }
    throw error;
  }
}

async function reserve(req: PackRequest, score: Address): Promise<PackOrderRow> {
  try {
    return await reserveOrder({ ...req, scoreContract: score });
  } catch (error) {
    if (error instanceof PackOrderError) {
      throw new PackIssueError(error.code, error.code === 'ACTIVE_ORDER_EXISTS' ? 409 : 429);
    }
    throw error;
  }
}

/** OP：只落订单入队，签名与广播由 cron 在持锁时完成（凭证 10 分钟有效，现签现用）。 */
export async function requestSponsoredPack(req: PackRequest): Promise<PackOrderRow> {
  const { score, pack } = await checkEligibility({ ...req, mode: 'op_sponsored' });
  const order = await reserve({ ...req, mode: 'op_sponsored' }, score);
  await supabaseAdmin.from('score_pack_orders').update({
    track_token_id: pack.trackTokenId.toString(), sound_ids: pack.soundIds.map(String),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  return order;
}

/** ETH：预占订单并签发凭证，交给用户钱包自己提交。凭证过期后可重新调用刷新。 */
export async function issueSelfPaidVoucher(req: PackRequest) {
  const { cfg, score, pack } = await checkEligibility({ ...req, mode: 'eth_self_paid' });
  const order = await reserve({ ...req, mode: 'eth_self_paid' }, score);
  const voucher = buildVoucher(req.tokenId, req.holder, pack);
  const signed = await signVoucher(req.chainId, cfg.opener, voucher);
  await supabaseAdmin.from('score_pack_orders').update({
    track_token_id: pack.trackTokenId.toString(), sound_ids: pack.soundIds.map(String),
    voucher_digest: signed.digest.toLowerCase(), voucher_deadline: Number(voucher.deadline),
    signer_address: signed.signer.toLowerCase(), updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  return {
    orderId: order.id, opener: cfg.opener, chainId: req.chainId,
    voucher: voucherToJson(voucher), signer: signed.signer, signature: signed.signature,
  };
}
