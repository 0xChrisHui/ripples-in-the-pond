import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/chain/operator-wallet';
import { formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { HealthResponse } from '@/src/types/tracks';

/**
 * GET /api/health?secret=xxx
 * 结构化健康检查：数据库 + 钱包 + 队列 + JWT 黑名单 + 最近告警
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const result: HealthResponse = {
    db: 'ok',
    wallet: 'ok',
    walletBalance: '0',
    pendingJobs: 0,
    scoreQueue: {},
    scoreQueueManualReview: 0,
    jwtBlacklistSize: 0,
    lastBalanceAlert: null,
    mintQueue: { failed: 0, stuck: 0, oldestAgeSeconds: null },
  };

  try {
    // 1. 数据库连接
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);
    if (dbError) result.db = 'error';

    // 2. 运营钱包余额
    const account = privateKeyToAccount(
      process.env.OPERATOR_PRIVATE_KEY as `0x${string}`,
    );
    const balance = await publicClient.getBalance({ address: account.address });
    const eth = parseFloat(formatEther(balance));
    result.walletBalance = eth.toFixed(6);
    if (eth < 0.001) result.wallet = 'critical';
    else if (eth < 0.05) result.wallet = 'low';

    // 3. mint_queue 积压
    const { count: mintPending } = await supabaseAdmin
      .from('mint_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'minting_onchain']);
    result.pendingJobs = mintPending ?? 0;

    // 4. score_nft_queue 状态分布
    const { data: scoreRows } = await supabaseAdmin
      .from('score_nft_queue')
      .select('status');
    const dist: Record<string, number> = {};
    for (const r of scoreRows ?? []) {
      dist[r.status] = (dist[r.status] ?? 0) + 1;
    }
    const { count: scoreManualReview } = await supabaseAdmin
      .from('score_nft_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .eq('failure_kind', 'manual_review');
    result.scoreQueueManualReview = scoreManualReview ?? 0;

    // 5. jwt_blacklist 大小
    const { count: blacklistSize } = await supabaseAdmin
      .from('jwt_blacklist')
      .select('jti', { count: 'exact', head: true });
    result.jwtBlacklistSize = blacklistSize ?? 0;

    // 6. 最近一次余额告警
    const { data: alertKv } = await supabaseAdmin
      .from('system_kv')
      .select('value')
      .eq('key', 'last_balance_alert')
      .maybeSingle();
    result.lastBalanceAlert = alertKv?.value ?? null;

    // 7. mint_queue 失败/卡住聚合（Phase 6 E1，Pre-tester gate 必备）
    //    stuck = minting_onchain 状态 + tx_hash 为空 + 已超 3 分钟没动 → 怀疑 cron 死锁
    //    P1-9 修复（2026-05-08 strict CTO review）：oldestAgeSeconds 改用 created_at（入队时刻）。
    //    原用 updated_at，cron 每次尝试都会刷 updated_at 即使没推进状态，age 永远 < cron 频率，
    //    告警系统无法区分"队列堆积"vs"cron 在循环重试同一行"。
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const [failedRes, stuckRes, oldestRes] = await Promise.all([
      supabaseAdmin
        .from('mint_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabaseAdmin
        .from('mint_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'minting_onchain')
        .is('tx_hash', null)
        .lt('updated_at', threeMinAgo),
      supabaseAdmin
        .from('mint_queue')
        .select('created_at')
        .in('status', ['pending', 'minting_onchain'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const oldestCreated = oldestRes.data?.created_at;
    result.mintQueue = {
      failed: failedRes.count ?? 0,
      stuck: stuckRes.count ?? 0,
      oldestAgeSeconds: oldestCreated
        ? Math.floor((Date.now() - new Date(oldestCreated).getTime()) / 1000)
        : null,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/health error:', err);
    return NextResponse.json({ ...result, db: 'error' }, { status: 500 });
  }
}
