import { getAddress } from 'viem';
import { getConfiguredScoreAddress } from '@/src/lib/chain/multichain/registry';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { readScoreOwner } from '@/src/lib/score-pack/chain';
import { PackIssueError, requestSponsoredPack } from '@/src/lib/score-pack/issue';
import { safeMessage } from '@/src/lib/score-pack/redact';
import { supabaseAdmin } from '@/src/lib/supabase';

type IntentRow = { pending_score_id: string; user_id: string; created_at: string };

/** 终局性问题：重试也不会好，丢弃意图。其余（额度、占用、未就绪、数据库/RPC 临时故障）一律保留重试。 */
const TERMINAL_CODES = new Set([
  'ALREADY_OPENED', 'NOT_HOLDER', 'MISSING_ASSETS', 'EMPTY_PACK', 'TOO_MANY_SOUNDS',
  'WRONG_CONTRACT', 'NOT_ENABLED', 'PACK_DISABLED',
]);
/** 保留重试的上限：超过后丢弃并记日志，避免永远失败的意图堆积 */
const MAX_INTENT_AGE_MS = 3 * 24 * 3_600_000;

/** 勾选意图 → OP 开包订单：Score 铸成功后自动入队。 */
export async function promoteOpIntents(limit = 20): Promise<{ promoted: number; kept: number; dropped: number }> {
  const { data, error } = await supabaseAdmin.from('score_pack_intents')
    .select('pending_score_id,user_id,created_at').order('created_at').limit(limit);
  if (error) throw error;
  let promoted = 0;
  let kept = 0;
  let dropped = 0;
  const score = getConfiguredScoreAddress(CHAIN_ID_NUM);
  const drop = (id: string) => supabaseAdmin.from('score_pack_intents').delete().eq('pending_score_id', id);
  for (const intent of (data ?? []) as IntentRow[]) {
    try {
      const { data: queue } = await supabaseAdmin.from('score_nft_queue')
        .select('token_id,status').eq('pending_score_id', intent.pending_score_id).maybeSingle();
      if (!queue || queue.status !== 'success' || queue.token_id == null) { kept += 1; continue; }
      const tokenId = BigInt(queue.token_id);
      const holder = await readScoreOwner(CHAIN_ID_NUM, score, tokenId); // RPC 故障会抛出，进入下面的保留分支
      if (!holder) { kept += 1; continue; }
      await requestSponsoredPack({
        chainId: CHAIN_ID_NUM, scoreContract: score, tokenId, userId: intent.user_id,
        holder: getAddress(holder), mode: 'op_sponsored',
      });
      await drop(intent.pending_score_id);
      promoted += 1;
    } catch (caught) {
      const terminal = caught instanceof PackIssueError && TERMINAL_CODES.has(caught.code);
      const expired = Date.now() - Date.parse(intent.created_at) > MAX_INTENT_AGE_MS;
      if (terminal || expired) {
        console.error('[score-pack] 意图丢弃：', intent.pending_score_id, terminal ? 'terminal' : 'expired', safeMessage(caught));
        await drop(intent.pending_score_id);
        dropped += 1;
      } else {
        kept += 1;
      }
    }
  }
  return { promoted, kept, dropped };
}
