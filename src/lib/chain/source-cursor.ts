import 'server-only';
import { supabaseAdmin } from '@/src/lib/supabase';
import { CHAIN_ID_NUM } from './chain-config';
import { SCORE_NFT_ADDRESS } from './contracts';
import {
  parseSourceCursor,
  requireSourceIdentity,
  sourceCursorKey,
  sourceSuccessKey,
} from '@/src/features/source-index/source-policy';

export type SourceIdentity = {
  chainId: number;
  contract: string;
  cursorKey: string;
  successKey: string;
};

export function getSourceIdentity(): SourceIdentity {
  const contract = SCORE_NFT_ADDRESS?.toLowerCase() ?? '';
  requireSourceIdentity(CHAIN_ID_NUM, contract);
  return {
    chainId: CHAIN_ID_NUM,
    contract,
    cursorKey: sourceCursorKey(CHAIN_ID_NUM, contract),
    successKey: sourceSuccessKey(CHAIN_ID_NUM, contract),
  };
}

export async function readSourceCursor(identity = getSourceIdentity()): Promise<bigint> {
  const { data, error } = await supabaseAdmin.from('system_kv').select('value')
    .eq('key', identity.cursorKey).single();
  if (error) throw new Error(`读取 source cursor 失败：${error.message}`);
  return parseSourceCursor(data?.value);
}

export async function advanceSourceCursor(
  expected: bigint,
  next: bigint,
  identity = getSourceIdentity(),
): Promise<bigint> {
  const { data, error } = await supabaseAdmin.rpc('advance_source_chain_cursor', {
    p_chain_id: identity.chainId,
    p_score_contract: identity.contract,
    p_expected: expected.toString(),
    p_next: next.toString(),
  });
  if (error) throw new Error(`推进 source cursor 失败：${error.message}`);
  const advanced = parseSourceCursor(String(data));
  if (advanced !== next) throw new Error('source cursor RPC 返回值与目标不一致');
  return advanced;
}

export async function recordSourceSyncSuccess(
  cursor: bigint,
  identity = getSourceIdentity(),
): Promise<void> {
  const { error } = await supabaseAdmin.from('system_kv').upsert({
    key: identity.successKey,
    value: JSON.stringify({ cursor: cursor.toString(), at: new Date().toISOString() }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw new Error(`记录 source sync 成功时间失败：${error.message}`);
}
