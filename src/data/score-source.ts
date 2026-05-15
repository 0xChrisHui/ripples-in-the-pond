import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/src/lib/supabase';
import { resolveArUrl } from '@/src/lib/arweave';
import { explorerTxUrl } from '@/src/lib/chain/chain-config';
import type { Track } from '@/src/types/tracks';

/**
 * /score/[id] 页面数据源（B8 重设：路由 ID 兼容 tokenId 数字 / queue.id UUID）
 *
 * 入口 getScoreById：纯数字按 token_id 查（兼容已上链历史链接 / 分享卡），
 * UUID 按 queue.id 查（B8 主路径，含未上链的中间态）。
 *
 * Phase 6 A5 链上灾备路径在 B8 后已删除（score-fallback.ts noop 残留 2026-05-08 清掉）。
 * 主路径 DB miss 直接 notFound；灾备方案待 P7 重新设计。
 *
 * C9b（2026-05-15）：首屏不再 SELECT events_data（大 JSON 阻塞 SSR），改拉
 * pending_scores.event_count generated column。events 走独立 endpoint
 * /api/scores/[id]/events 由 ScorePlayer 挂载时按需 fetch（score-events-source.ts）。
 * getScoreById 用 React cache() 包装：同 request 内 generateMetadata + page 只跑一次。
 */

export interface ScorePageData {
  /** 路由用 ID（tokenId.toString() 或 queue.id UUID）*/
  id: string;
  /** 已上链 tokenId — 未上链时 undefined */
  tokenId?: number;
  trackTitle: string;
  creatorAddress: string;
  /** 底曲信息（PlayerProvider.toggle + useEventsPlayback 用）*/
  track: Track;
  coverUrl: string;
  /** 已上链 tx hash — 未上链时 undefined */
  txHash?: string;
  /** 已上链 Etherscan link — 未上链时 undefined */
  etherscanUrl?: string;
  mintedAt: string;
  eventCount: number;
}


/** 路由入口：纯数字 → tokenId 路径，否则按 UUID → queue.id 路径
 *  cache(): per-request dedupe（generateMetadata + page 共享同一 request 时只跑一次）。
 */
export const getScoreById = cache(
  async (id: string): Promise<ScorePageData | null> => {
    if (/^\d+$/.test(id)) {
      const n = Number(id);
      // 防御：> 2^53 数字会丢精度；DB token_id 是 int4（~2.1B 上限）远在安全范围内。
      if (!Number.isSafeInteger(n)) return null;
      return getScoreByTokenId(n);
    }
    return getScoreByQueueId(id);
  },
);

/** 已上链历史路径（兼容 /score/123 旧链接 + 分享卡）— B8 后转发到 queue 主路径
 *  order/limit 取最新（非 maybeSingle）：避免历史 race 留下双行时静默 404。
 */
async function getScoreByTokenId(
  tokenId: number,
): Promise<ScorePageData | null> {
  const { data: queueRow, error } = await supabaseAdmin
    .from('score_nft_queue')
    .select('id')
    .eq('token_id', tokenId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[score-source] tokenId → queue lookup failed:', error);
    return null;
  }
  if (!queueRow) return null;

  return getScoreByQueueId(queueRow.id);
}

/** B8 主路径：queue.id 直接查（含未上链中间态 / 失败态）
 *  分独立 query — supabase 联表对多外键关系偶尔报歧义错。
 *  C9b：pending_scores 改拉 event_count（generated column），不拉 events_data。
 */
async function getScoreByQueueId(
  queueId: string,
): Promise<ScorePageData | null> {
  const { data: queue, error: qErr } = await supabaseAdmin
    .from('score_nft_queue')
    .select(
      'token_id, tx_hash, created_at, cover_ar_tx_id, user_id, pending_score_id, track_id',
    )
    .eq('id', queueId)
    .maybeSingle();

  if (qErr) {
    console.error('[score-source] queue query failed:', qErr);
    return null;
  }
  if (!queue) return null;

  const [pendingRes, trackRes, userRes] = await Promise.allSettled([
    supabaseAdmin
      .from('pending_scores')
      .select('event_count')
      .eq('id', queue.pending_score_id)
      .maybeSingle(),
    supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', queue.track_id)
      .maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('evm_address')
      .eq('id', queue.user_id)
      .maybeSingle(),
  ]);

  if (trackRes.status === 'rejected' || userRes.status === 'rejected') {
    console.error('[score-source] required relation query rejected', {
      queueId,
      track: trackRes.status === 'rejected' ? trackRes.reason : 'ok',
      user: userRes.status === 'rejected' ? userRes.reason : 'ok',
    });
    return null;
  }

  const track = trackRes.value.data as Track | null;
  const user = userRes.value.data;
  if (!track || !user) {
    console.error('[score-source] missing relation', {
      queueId,
      hasTrack: !!track,
      hasUser: !!user,
    });
    return null;
  }

  // pending_scores 缺失/报错降级 eventCount=0，但都 log（"0 个音符"会被误以为空草稿）
  let eventCount = 0;
  if (pendingRes.status === 'rejected') {
    console.error('[score-source] pending_scores query rejected:', pendingRes.reason);
  } else if (pendingRes.value.error) {
    console.error('[score-source] pending_scores query error:', pendingRes.value.error);
  } else if (typeof pendingRes.value.data?.event_count === 'number') {
    eventCount = pendingRes.value.data.event_count;
  }

  // cover_ar_tx_id 非法降级 coverUrl=''：OG 走色块，详情页 <img> broken 但不整页崩
  let coverUrl = '';
  try {
    coverUrl = resolveArUrl(queue.cover_ar_tx_id);
  } catch (err) {
    console.error('[score-source] cover txId invalid:', {
      queueId,
      cover_ar_tx_id: queue.cover_ar_tx_id,
      err,
    });
  }

  return {
    id: queueId,
    tokenId: queue.token_id ?? undefined,
    trackTitle: track.title,
    creatorAddress: user.evm_address,
    track,
    coverUrl,
    txHash: queue.tx_hash ?? undefined,
    etherscanUrl: queue.tx_hash ? explorerTxUrl(queue.tx_hash) : undefined,
    mintedAt: queue.created_at,
    eventCount,
  };
}
