import { isAddress, type Address } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/chain/public-client';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI, ORCHESTRATOR_ADDRESS } from '@/src/lib/chain/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/score-mint';
import { ATOMIC_ABI, saveAtomic } from './shared';
import { verifyIssuanceResources } from './readiness';
import { confirmAtomic } from './confirm';
import { sendAtomic } from './send';

export async function stepAtomicIssue(row: ScoreMintQueueRow, owner: string, deadline: number): Promise<ScoreMintStatus> {
  if (row.tx_hash) return confirmAtomic(row, owner);
  if (row.mint_attempted_at) {
    if (Date.now() - Date.parse(row.mint_attempted_at) > 600_000) {
      throw Error('CRITICAL: 原子发行发送结果未知，禁止盲重发');
    }
    return 'minting_onchain';
  }
  if (!row.expected_token_id) {
    const { data: enabled, error: flagError } = await supabaseAdmin.from('system_kv')
      .select('value').eq('key', 'score-atomic:enabled').maybeSingle();
    if (flagError) throw flagError;
    if (enabled?.value !== 'true') return 'minting_onchain';
    const issuer = process.env.ATOMIC_SCORE_ISSUER_ADDRESS;
    if (!issuer || !isAddress(issuer)) throw Error('CRITICAL: 未配置有效原子发行入口');
    const [nft, orchestrator] = await Promise.all([
      publicClient.readContract({ address: issuer, abi: ATOMIC_ABI, functionName: 'scoreNft' }),
      publicClient.readContract({ address: issuer, abi: ATOMIC_ABI, functionName: 'orchestrator' }),
    ]);
    if (nft.toLowerCase() !== SCORE_NFT_ADDRESS.toLowerCase()
      || orchestrator.toLowerCase() !== ORCHESTRATOR_ADDRESS.toLowerCase()) throw Error('CRITICAL: 原子入口绑定错误');
    const { data: user, error } = await supabaseAdmin.from('users').select('evm_address').eq('id', row.user_id).single();
    if (error || !user || !isAddress(user.evm_address)) throw Error('CRITICAL: 发行接收地址无效');
    // eth_call 不产生真实 NFT；最终仍由合约 expectedTokenId 检查抵御竞争。
    const simulation = await publicClient.simulateContract({ address: SCORE_NFT_ADDRESS, abi: SCORE_NFT_ABI,
      functionName: 'mint', args: [user.evm_address as Address], account: issuer });
    const candidate = Number(simulation.result);
    if (!Number.isSafeInteger(candidate) || candidate <= 0) throw Error('CRITICAL: 预计编号超出范围');
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc('reserve_atomic_score', {
      p_queue_id: row.id, p_owner: owner, p_issuer: issuer, p_recipient: user.evm_address,
      p_expected_token_id: candidate,
    });
    if (reserveError) throw reserveError;
    // 被另一单占用时正常暂停，不消耗重试，也不重排已经固定的编号。
    return reserved ? 'uploading_metadata' : 'minting_onchain';
  }
  if (row.metadata_upload_state !== 'verified') return 'uploading_metadata';
  const age = Date.now() - Date.parse(row.atomic_ready_at ?? '');
  // 验收必须覆盖本轮最晚广播时刻，包含保存哈希和钱包锁检查的耗时。
  if (!Number.isFinite(age) || age < 0 || deadline - Date.parse(row.atomic_ready_at!) >= 300_000) {
    await verifyIssuanceResources(row);
    await saveAtomic(row, owner, { atomic_ready_at: new Date().toISOString() });
    return 'minting_onchain';
  }
  await sendAtomic(row, owner, deadline);
  return 'minting_onchain';
}
