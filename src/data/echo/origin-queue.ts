import 'server-only';

import { getAddress } from 'viem';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import type { ServerTiming } from '@/src/lib/performance/server-timing';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';

type OriginRow = {
  status: WalletRecipeQueueStatus;
  token_id: number | null;
  token_uri: string | null;
  origin_wallet: string;
  last_error: string | null;
};

/** 只读当前链、来源合约和 origin 的队列行；不查询现持有人。 */
export async function readOriginQueue(origin: string, timing?: ServerTiming): Promise<{
  row: OriginRow | null;
  unavailable: boolean;
}> {
  let scoreContract: string;
  try { scoreContract = getAddress(SCORE_NFT_ADDRESS).toLowerCase(); } catch {
    return { row: null, unavailable: true };
  }
  const query = () => (
    supabaseAdmin.from('wallet_recipe_queue')
      .select('status,token_id,token_uri,origin_wallet,last_error')
      .eq('chain_id', CHAIN_ID_NUM).eq('source_score_contract', scoreContract)
      .eq('origin_wallet_key', origin.toLowerCase()).maybeSingle()
  );
  const { data, error } = await (timing ? timing.measure('db', query) : query());
  if (error) return { row: null, unavailable: true };
  return { row: data as OriginRow | null, unavailable: false };
}
