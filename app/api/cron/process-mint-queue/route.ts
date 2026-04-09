import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import {
  operatorWalletClient,
  publicClient,
} from '@/src/lib/operator-wallet';
import {
  MATERIAL_NFT_ADDRESS,
  MATERIAL_NFT_ABI,
} from '@/src/lib/contracts';

/**
 * GET /api/cron/process-mint-queue?secret=xxx
 * 从 mint_queue 取一条 pending → 调合约 mint → 更新 status
 * 一次只处理一条（nonce 串行要求）
 */
export async function GET(req: NextRequest) {
  // job.id 存在外层，catch 里用同一个 id 回滚（修复：失败补偿绑定当前任务）
  let claimedJobId: string | null = null;
  let claimedRetryCount = 0;

  try {
    // 1. 验证 secret
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
    }

    // 2. 原子抢单：查 pending + 标记 minting_onchain 一步完成（修复：防并发双 mint）
    const { data: jobs, error: claimError } = await supabaseAdmin
      .rpc('claim_pending_job');

    if (claimError || !jobs || jobs.length === 0) {
      return NextResponse.json({ result: 'ok', processed: 0 });
    }

    const job = jobs[0];
    claimedJobId = job.id;
    claimedRetryCount = job.retry_count;

    // 3. 查用户的 evm_address
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('evm_address')
      .eq('id', job.user_id)
      .single();

    if (!user) {
      await supabaseAdmin
        .from('mint_queue')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', claimedJobId);
      return NextResponse.json({ error: '找不到用户' }, { status: 500 });
    }

    // 4. 调合约 mint（运营钱包代付 gas）
    const txHash = await operatorWalletClient.writeContract({
      address: MATERIAL_NFT_ADDRESS,
      abi: MATERIAL_NFT_ABI,
      functionName: 'mint',
      args: [
        user.evm_address as `0x${string}`,
        BigInt(job.token_id),
        1n,
        '0x',
      ],
    });

    // 5. 等交易确认
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === 'success') {
      await supabaseAdmin
        .from('mint_queue')
        .update({
          status: 'success',
          tx_hash: txHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimedJobId);
    } else {
      throw new Error('交易回滚');
    }

    return NextResponse.json({ result: 'ok', processed: 1, txHash });
  } catch (err) {
    console.error('cron process-mint-queue error:', err);

    // 失败补偿：用 claimedJobId 精确回滚当前任务（修复：不再查任意 minting_onchain）
    if (claimedJobId) {
      const newStatus = claimedRetryCount >= 3 ? 'failed' : 'pending';
      await supabaseAdmin
        .from('mint_queue')
        .update({
          status: newStatus,
          retry_count: claimedRetryCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimedJobId);
    }

    return NextResponse.json(
      { error: '处理失败' },
      { status: 500 },
    );
  }
}
