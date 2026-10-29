import { getAddress } from 'viem';
import { getConfiguredScoreAddress } from '@/src/lib/chain/multichain/registry';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { readScoreOwner } from '@/src/lib/score-pack/chain';
import { PackIssueError, requestSponsoredPack } from '@/src/lib/score-pack/issue';
import { supabaseAdmin } from '@/src/lib/supabase';

type IntentRow = { pending_score_id: string; user_id: string };

/** 勾选意图 → OP 开包订单：Score 铸成功后自动入队；失败的意图保留，下一轮继续（额度类错误不删）。 */
export async function promoteOpIntents(limit = 20): Promise<{ promoted: number; kept: number }> {
  const { data, error } = await supabaseAdmin.from('score_pack_intents')
    .select('pending_score_id,user_id').order('created_at').limit(limit);
  if (error) throw error;
  let promoted = 0;
  let kept = 0;
  const score = getConfiguredScoreAddress(CHAIN_ID_NUM);
  for (const intent of (data ?? []) as IntentRow[]) {
    const { data: queue } = await supabaseAdmin.from('score_nft_queue')
      .select('token_id,status').eq('pending_score_id', intent.pending_score_id).maybeSingle();
    if (!queue || queue.status !== 'success' || queue.token_id == null) { kept += 1; continue; }
    const tokenId = BigInt(queue.token_id);
    const holder = await readScoreOwner(CHAIN_ID_NUM, score, tokenId);
    if (!holder) { kept += 1; continue; }
    try {
      await requestSponsoredPack({
        chainId: CHAIN_ID_NUM, scoreContract: score, tokenId, userId: intent.user_id,
        holder: getAddress(holder), mode: 'op_sponsored',
      });
    } catch (caught) {
      // 已开/资料缺口等终局性问题不再重试；额度与占用类保留到下一轮
      const retry = caught instanceof PackIssueError
        && ['GLOBAL_LIMIT', 'USER_LIMIT', 'ACTIVE_ORDER_EXISTS', 'NO_SNAPSHOT'].includes(caught.code);
      if (retry) { kept += 1; continue; }
      console.error('[score-pack] 意图转订单失败，丢弃：', intent.pending_score_id, caught);
    }
    await supabaseAdmin.from('score_pack_intents').delete().eq('pending_score_id', intent.pending_score_id);
    promoted += 1;
  }
  return { promoted, kept };
}
