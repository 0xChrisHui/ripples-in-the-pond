import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { acquireOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
import { tryConfirmMinting, trySendNew } from './steps';
import { reconcileMaterialMints } from '@/src/lib/material-mint/server/reconcile/worker';
import { safeMessage } from '@/src/lib/score-pack/redact';
import { runScorePackCycle } from '../process-score-pack/cycle';

/**
 * GET /api/cron/process-mint-queue
 * 素材 NFT 铸造 — 两步状态机，每步 < 5 秒：
 *   第 1 次 cron：pending → minting_onchain（发交易 + 存 tx_hash）
 *   第 2 次 cron：minting_onchain → success（查 receipt + 写 mint_events）
 *
 * 每次调用优先完成 minting_onchain，再抢新 pending。
 * 一次只处理一条（nonce 串行要求）。
 *
 * Phase 6 A0：入口拿运营钱包全局锁，避免和 score / airdrop cron nonce race。
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const holder = `mint-queue-${randomUUID()}`;
  const deadline = Date.now() + 25_000;
  let primary;
  try {
    if (await acquireOpLock(holder)) {
      try {
        primary = await tryConfirmMinting() ?? await trySendNew(holder, deadline);
      } finally {
        await releaseOpLock(holder);
      }
    } else {
      primary = { result: 'busy', processed: 0 };
    }
    // 附属对账获得独立机会；仅真正广播时使用新锁。
    let scorePack: Record<string, unknown> | undefined;
    if (process.env.NEXT_PUBLIC_P22_OPENER_10 || process.env.NEXT_PUBLIC_P22_OPENER_11155420) {
      try {
        scorePack = await runScorePackCycle({ batch: 1, deadline });
      } catch (error) {
        console.error('[mint-queue] score-pack cycle failed:', safeMessage(error));
      }
    }

    // 复用既有分钟调度，仅在OP空闲时对账一单、一页；关闭新发行仍允许恢复旧单。
    if (process.env.ETH_MATERIAL_DEPLOYMENT_BLOCK) {
      try {
        const material = await reconcileMaterialMints(1, 1);
        if (material.failed) return NextResponse.json({ result: 'material_reconcile_unavailable', processed: 0, material }, { status: 503 });
        return NextResponse.json({ ...(primary ?? { result: 'idle', processed: 0 }), material, scorePack });
      } catch {
        return NextResponse.json({ result: 'material_reconcile_unavailable', processed: 0 }, { status: 503 });
      }
    }
    return NextResponse.json({ ...(primary ?? { result: 'idle', processed: 0 }), scorePack });
  } catch (err) {
    console.error('[mint-queue] error:', err);
    return NextResponse.json(
      { error: '处理失败' },
      { status: 500 },
    );
  }
}
