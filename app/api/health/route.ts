import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/operator-wallet';
import { formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { HealthResponse } from '@/src/types/tracks';

/**
 * GET /api/health?secret=xxx
 * 结构化健康检查：数据库 + 钱包 + 队列 + JWT 黑名单 + 最近告警
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const result: HealthResponse = {
    db: 'ok',
    wallet: 'ok',
    walletBalance: '0',
    pendingJobs: 0,
    scoreQueue: {},
    jwtBlacklistSize: 0,
    lastBalanceAlert: null,
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
    result.scoreQueue = dist;

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

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/health error:', err);
    return NextResponse.json({ ...result, db: 'error' }, { status: 500 });
  }
}
