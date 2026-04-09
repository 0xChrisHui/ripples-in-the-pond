import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/operator-wallet';
import { formatEther } from 'viem';
import type { HealthResponse } from '@/src/types/tracks';

/**
 * GET /api/health?secret=xxx
 * 最小健康检查：数据库连接 + 运营钱包余额 + 队列积压
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
  };

  try {
    // 1. 数据库连接检查
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);
    if (dbError) result.db = 'error';

    // 2. 运营钱包余额
    const operatorAddress = process.env.OPERATOR_PRIVATE_KEY
      ? (await import('viem/accounts')).privateKeyToAccount(
          process.env.OPERATOR_PRIVATE_KEY as `0x${string}`,
        ).address
      : null;

    if (operatorAddress) {
      const balance = await publicClient.getBalance({ address: operatorAddress });
      const eth = parseFloat(formatEther(balance));
      result.walletBalance = eth.toFixed(6);

      if (eth < 0.001) result.wallet = 'critical';
      else if (eth < 0.005) result.wallet = 'low';
    }

    // 3. 队列积压
    const { count } = await supabaseAdmin
      .from('mint_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'minting_onchain']);
    result.pendingJobs = count ?? 0;

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/health error:', err);
    return NextResponse.json({ ...result, db: 'error' }, { status: 500 });
  }
}
