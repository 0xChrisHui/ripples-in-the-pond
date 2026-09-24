import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import { SCORE_STATUSES, type MyScoreNFTsResponse, type OwnedScoreNFT, type ScoreMintStatus } from '@/src/types/jam';
import { SELF_MINT_STATUSES, type SelfMintStatus } from '@/src/types/self-mint';

function readStatus(value: unknown): ScoreMintStatus {
  if (typeof value === 'string' && SCORE_STATUSES.some((status) => status === value)) {
    return value as ScoreMintStatus;
  }
  throw new Error(`未知 Score 状态: ${String(value)}`);
}

function readSelfStatus(value: unknown): SelfMintStatus {
  if (typeof value === 'string' && SELF_MINT_STATUSES.some((status) => status === value)) {
    return value as SelfMintStatus;
  }
  throw new Error(`未知 Ethereum Score 状态: ${String(value)}`);
}

/**
 * GET /api/me/score-nfts
 * 返回当前用户的"我的唱片"列表 — B8 重设（2026-05-08）
 *
 * 数据源 = score_nft_queue 全部 row（**不再** filter status='success'）。
 * 用户感知"我的唱片"与链上完成度脱钩；token_id / tx_hash 是 progressive enhancement，
 * 未上链时为 null，前端显示"上链中"，cron 跑完后字段补齐。
 *
 * eventCount 来源：联表 pending_scores.event_count（migration 031 generated column，
 * 不再拉整个 events_data jsonb 数组算 length）— P1-19 修复（2026-05-08 strict CTO review）。
 */

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(req));
    if (!auth) {
      return timing.response(() => NextResponse.json({ error: '未登录' }, { status: 401 }));
    }

    const [opResult, ethResult] = await timing.measure('db', () => Promise.all([
      supabaseAdmin
        .from('score_nft_queue')
        .select(`
          id, token_id, tx_hash, created_at, status, failure_kind,
          package_ar_tx_id, package_sha256, package_bytes, package_mime, package_upload_state,
          tracks:tracks!score_nft_queue_track_id_fkey(title),
          pending_scores(event_count)
        `)
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('score_self_mint_orders')
        .select(`
          id, order_id, token_id, tx_hash, created_at, status, failure_code,
          chain_id, score_contract, recipient_address,
          package_ar_tx_id, package_sha256, package_bytes, package_mime, package_upload_state,
          tracks:tracks!score_self_mint_orders_track_id_fkey(title),
          pending_scores(event_count)
        `)
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
    ]));

    if (opResult.error) throw opResult.error;
    if (ethResult.error) throw ethResult.error;

    const opScores: OwnedScoreNFT[] = (opResult.data ?? []).map((r) => {
      const trackData = r.tracks as unknown as { title: string } | null;
      const ps = r.pending_scores as unknown as { event_count: number | null } | null;
      const status = readStatus(r.status);
      const failureKind = r.failure_kind === 'safe_retry' || r.failure_kind === 'manual_review'
        ? r.failure_kind
        : null;
      const scorePackage = status === 'success' && r.package_upload_state === 'verified'
        && typeof r.package_ar_tx_id === 'string' && typeof r.package_sha256 === 'string'
        && typeof r.package_bytes === 'number' && r.package_mime === 'application/json'
        ? { ref: `ar://${r.package_ar_tx_id}` as const, sha256: r.package_sha256,
          bytes: r.package_bytes, mime: r.package_mime }
        : undefined;
      return {
        id: status === 'success' && r.token_id != null ? String(r.token_id) : r.id,
        queueId: r.id,
        tokenId: r.token_id ?? undefined,
        status,
        trackTitle: trackData?.title ?? '未知曲目',
        eventCount: ps?.event_count ?? null,
        txHash: r.tx_hash ?? undefined,
        failureKind,
        submittedAt: r.created_at,
        mintMode: 'op_sponsored',
        ...(scorePackage ? { scorePackage } : {}),
      };
    });

    const ethScores: OwnedScoreNFT[] = (ethResult.data ?? []).map((r) => {
      const trackData = r.tracks as unknown as { title: string } | null;
      const ps = r.pending_scores as unknown as { event_count: number | null } | null;
      const status = readSelfStatus(r.status);
      const scorePackage = status === 'success' && r.package_upload_state === 'verified'
        && typeof r.package_ar_tx_id === 'string' && typeof r.package_sha256 === 'string'
        && typeof r.package_bytes === 'number' && r.package_mime === 'application/json'
        ? { ref: `ar://${r.package_ar_tx_id}` as const, sha256: r.package_sha256,
          bytes: r.package_bytes, mime: r.package_mime }
        : undefined;
      return {
        id: status === 'success' && r.token_id != null
          ? `${r.chain_id}:${r.score_contract}:${r.token_id}` : r.id,
        queueId: r.id,
        tokenId: r.token_id ?? undefined,
        status,
        trackTitle: trackData?.title ?? '未知曲目',
        eventCount: ps?.event_count ?? null,
        txHash: r.tx_hash ?? undefined,
        failureKind: status === 'manual_review' ? 'manual_review' : null,
        submittedAt: r.created_at,
        mintMode: 'eth_self_paid',
        chainId: r.chain_id,
        contractAddress: r.score_contract,
        orderId: r.order_id,
        recipientAddress: r.recipient_address,
        ...(scorePackage ? { scorePackage } : {}),
      };
    });

    const scoreNfts = [...opScores, ...ethScores]
      .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));

    const res: MyScoreNFTsResponse = { scoreNfts };
    return timing.response(() => NextResponse.json(res));
  } catch (err) {
    console.error('GET /api/me/score-nfts error:', err);
    return timing.response(() => (
      NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
    ));
  }
}
