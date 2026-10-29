import 'server-only';

import { supabaseAdmin } from '@/src/lib/supabase';
import {
  ACTIVE_STATUSES, OP_DAILY_GLOBAL_LIMIT, OP_DAILY_USER_LIMIT, canTransition, type PackOrderStatus,
} from './rules';

export type PackOrderRow = {
  id: string;
  user_id: string;
  chain_id: 1 | 10 | 11155111 | 11155420;
  score_contract: string;
  token_id: number;
  holder_address: string;
  mode: 'op_sponsored' | 'eth_self_paid';
  status: PackOrderStatus;
  track_token_id: string | null;
  sound_ids: string[] | null;
  voucher_digest: string | null;
  voucher_deadline: number | null;
  signer_address: string | null;
  tx_hash: string | null;
  block_number: number | null;
  account_address: string | null;
  attempts: number;
  next_attempt_at: string | null;
  failure_code: string | null;
  last_error: string | null;
  locked_by: string | null;
  lease_expires_at: string | null;
  opened_at: string | null;
  created_at: string;
};

export class PackOrderError extends Error {
  constructor(readonly code: 'GLOBAL_LIMIT' | 'USER_LIMIT' | 'ACTIVE_ORDER_EXISTS', message: string) {
    super(message);
  }
}

export async function reserveOrder(input: {
  userId: string; chainId: number; scoreContract: string; tokenId: bigint;
  holder: string; mode: PackOrderRow['mode'];
}): Promise<PackOrderRow> {
  const { data, error } = await supabaseAdmin.rpc('reserve_score_pack_order', {
    p_user_id: input.userId, p_chain_id: input.chainId,
    p_contract: input.scoreContract.toLowerCase(), p_token_id: Number(input.tokenId),
    p_holder: input.holder.toLowerCase(), p_mode: input.mode,
    p_global_limit: OP_DAILY_GLOBAL_LIMIT, p_user_limit: OP_DAILY_USER_LIMIT,
  });
  if (error) {
    for (const code of ['GLOBAL_LIMIT', 'USER_LIMIT', 'ACTIVE_ORDER_EXISTS'] as const) {
      if (error.message.includes(code)) throw new PackOrderError(code, error.message);
    }
    throw new Error(`资产包订单预占失败：${error.message}`);
  }
  return data as PackOrderRow;
}

/** 带状态机校验的 CAS 更新：只有当前状态仍为 from 时才写入。 */
export async function transitionOrder(
  id: string, from: PackOrderStatus, to: PackOrderStatus, values: Record<string, unknown> = {},
): Promise<PackOrderRow | null> {
  if (from !== to && !canTransition(from, to)) throw new Error(`非法订单迁移：${from} → ${to}`);
  const { data, error } = await supabaseAdmin.from('score_pack_orders')
    .update({ ...values, status: to, updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', from).select('*').maybeSingle();
  if (error) throw error;
  return data as PackOrderRow | null;
}

export async function findActiveOrder(
  chainId: number, scoreContract: string, tokenId: bigint,
): Promise<PackOrderRow | null> {
  const { data, error } = await supabaseAdmin.from('score_pack_orders').select('*')
    .eq('chain_id', chainId).eq('score_contract', scoreContract.toLowerCase())
    .eq('token_id', Number(tokenId)).in('status', [...ACTIVE_STATUSES])
    .maybeSingle();
  if (error) throw error;
  return data as PackOrderRow | null;
}

export async function findOrderById(id: string): Promise<PackOrderRow | null> {
  const { data, error } = await supabaseAdmin.from('score_pack_orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as PackOrderRow | null;
}

export function publicPackOrder(row: PackOrderRow) {
  return {
    orderId: row.id, chainId: row.chain_id, scoreContract: row.score_contract,
    tokenId: String(row.token_id), mode: row.mode, status: row.status,
    txHash: row.tx_hash, failureCode: row.failure_code, attempts: row.attempts,
    openedAt: row.opened_at,
  };
}
