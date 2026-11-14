import type { Address } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import { operatorWalletClient } from '@/src/lib/chain/operator-wallet';
import { broadcastOperator } from '@/src/lib/chain/broadcast/operator';
import { guardedWallet } from '@/src/lib/chain/broadcast/guarded-wallet';
import type { ScoreMintQueueRow } from '@/src/types/score-mint';
import { ATOMIC_ABI, issueArgs, saveAtomic } from './shared';

export async function sendAtomic(row: ScoreMintQueueRow, owner: string, deadline: number) {
  let attempt = '';
  try { await broadcastOperator(operatorWalletClient.account.address, {
    stamp: async () => {
      attempt = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from('score_nft_queue')
        .update({ mint_attempted_at: attempt, updated_at: attempt }).eq('id', row.id)
        .eq('locked_by', owner).is('mint_attempted_at', null).is('tx_hash', null)
        .gt('lease_expires_at', attempt).select('id').maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    unstamp: async () => {
      // 已保存签名哈希的单不能清发送戳；即使未发出也交由同哈希对账。
      const { error } = await supabaseAdmin.from('score_nft_queue').update({ mint_attempted_at: null })
        .eq('id', row.id).eq('locked_by', owner).eq('mint_attempted_at', attempt).is('tx_hash', null);
      if (error) throw error;
    },
    send: beforeRaw => guardedWallet(operatorWalletClient.account, operatorWalletClient.chain, async hash => {
      const age = Date.now() - Date.parse(row.atomic_ready_at ?? '');
      if (!Number.isFinite(age) || age < 0 || age >= 300_000) throw Error('ATOMIC_READINESS_EXPIRED');
      // 先保存订单，再让公共协议写全钱包发送标记；写库失败不能堵住其他业务的钱包。
      await saveAtomic(row, owner, { tx_hash: hash });
      await beforeRaw(hash);
    }).writeContract({ address: row.atomic_issuer as Address, abi: ATOMIC_ABI,
      functionName: 'mintScoreWithURI', args: issueArgs(row) }),
    save: hash => saveAtomic(row, owner, { tx_hash: hash }),
  }, deadline);
  } catch (error) {
    if (error instanceof Error && error.message === 'ATOMIC_READINESS_EXPIRED') return;
    throw error;
  }
}
