import { NextRequest, NextResponse } from 'next/server';
import { formatEther } from 'viem';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { operatorWalletClient, publicClient } from '@/src/lib/chain/operator-wallet';
import { getTurboUploadBudget } from '@/src/lib/arweave/core';
import { SCORE_ACTIVE_STATUSES } from '@/src/types/jam';
import { notifyOnce } from '@/src/lib/alerts/once';
import { inspectQueue, manualSummary, type Notice } from './queue';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  const notices: Notice[] = [];
  const readings: Record<string, number | string> = {};
  async function measure(queue: string, work: () => Promise<void>) {
    try { await work(); } catch {
      notices.push({ queue, kind: 'read-error', message: '监控数据不可读取' });
    }
  }
  await Promise.all([
    measure('operator', async () => {
      const balance = await publicClient.getBalance({ address: operatorWalletClient.account.address });
      readings.ethBalance = formatEther(balance);
      if (balance < 5_000_000_000_000_000n) notices.push({ queue: 'operator', kind: 'balance', message: `钱包余额 ${readings.ethBalance} ETH，低于 0.005 ETH` });
    }),
    measure('turbo', async () => {
      // 生产样本每种资源的最大字节数，分别按 Turbo 现价报价。
      const { effectiveBalanceWinc, requiredWinc } = await getTurboUploadBudget([2531, 867, 778], false);
      readings.turboBalanceWinc = effectiveBalanceWinc;
      if (BigInt(effectiveBalanceWinc) < 200n * BigInt(requiredWinc)) notices.push({
        queue: 'turbo', kind: 'balance', message: 'Turbo 余额不足以支付 200 单样本上传费用',
      });
    }),
    measure('mint_queue', async () => { readings.mintBacklog = await inspectQueue('mint_queue', ['pending', 'minting_onchain'], notices); }),
    measure('score_nft_queue', async () => { readings.scoreBacklog = await inspectQueue('score_nft_queue', [...SCORE_ACTIVE_STATUSES], notices); }),
    measure('score', () => manualSummary(notices)),
  ]);
  let delivered = true;
  if (notices.length) {
    const { error } = await supabaseAdmin.from('system_kv').upsert({ key: 'last_balance_alert',
      value: JSON.stringify({ ...readings, notices, timestamp: new Date().toISOString() }), updated_at: new Date().toISOString() });
    if (error) notices.push({ queue: 'monitor', kind: 'read-error', message: '巡检记录未保存' });
    const results = await Promise.all(notices.map(n => notifyOnce(n.queue, n.kind, n.queue + ' ' + n.kind, n.message)));
    delivered = results.every(Boolean);
  }
  const failed = !delivered || notices.some(n => n.kind === 'read-error');
  return NextResponse.json({ result: failed ? 'unavailable' : 'ok', ...readings, alertCount: notices.length,
    alerts: notices.map(n => n.message) }, { status: failed ? 503 : 200 });
}
