import 'server-only';
import { supabaseAdmin } from '@/src/lib/supabase';
import { resolveArUrl } from '@/src/lib/arweave';
import type { KeyEvent } from '@/src/types/jam';
import type { Track } from '@/src/types/tracks';

/**
 * /score/[id] 页面数据源（B8 重设：路由 ID 兼容 tokenId 数字 / queue.id UUID）
 *
 * 入口 getScoreById：纯数字按 token_id 查（兼容已上链历史链接 / 分享卡），
 * UUID 按 queue.id 查（B8 主路径，含未上链的中间态）。
 *
 * Phase 6 A5 链上灾备路径在 B8 后已删除（score-fallback.ts noop 残留 2026-05-08 清掉）。
 * 主路径 DB miss 直接 notFound；灾备方案待 P7 重新设计（链上 metadata 拿不到完整 Track）。
 */

export interface ScorePageData {
  /** 路由用 ID（tokenId.toString() 或 queue.id UUID）*/
  id: string;
  /** 已上链 tokenId — 未上链时 undefined */
  tokenId?: number;
  trackTitle: string;
  creatorAddress: string;
  /** 按键事件序列（前端 inline 播放用）*/
  events: KeyEvent[];
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

const ETHERSCAN_BASE = 'https://sepolia-optimism.etherscan.io/tx';

/** 路由入口：纯数字 → tokenId 路径，否则按 UUID → queue.id 路径 */
export async function getScoreById(id: string): Promise<ScorePageData | null> {
  if (/^\d+$/.test(id)) {
    const n = Number(id);
    // 防御：> 2^53 数字会丢精度；DB token_id 是 int4（~2.1B 上限）远在安全范围内，
    // 所以超出 = 非法路由，直接 null（避免 .eq() 收到失真值进而误中或类型错）
    if (!Number.isSafeInteger(n)) return null;
    return getScoreByTokenId(n);
  }
  return getScoreByQueueId(id);
}

/**
 * 已上链历史路径（兼容 /score/123 旧链接 + 分享卡）— B8 后转发到 queue 主路径
 *
 * 取 created_at 最新行（非 .maybeSingle）：5/6 Bug C 之类异常历史可能让 token_id
 * 命中多个 queue row（race 或运营手补），此时 .maybeSingle() 会抛 PGRST116
 * 让旧分享卡静默 404；用 order/limit 取最新那条避免误伤。
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
 *  分独立 query 而不是嵌套 select — supabase 联表对多外键关系偶尔报歧义错。
 *  Promise.allSettled：track/user 必需，pending_scores 是 nice-to-have（缺失降级 events=[]）。
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
      .select('events_data')
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

  // pending_scores 缺失/报错时降级 events=[]，但都 log 出来便于排查（B8 后此表是
  // events 唯一来源；silent failure 会让用户看到"0 个音符"误以为是空草稿）
  let events: KeyEvent[] = [];
  if (pendingRes.status === 'rejected') {
    console.error('[score-source] pending_scores query rejected:', pendingRes.reason);
  } else if (pendingRes.value.error) {
    console.error('[score-source] pending_scores query error:', pendingRes.value.error);
  } else if (Array.isArray(pendingRes.value.data?.events_data)) {
    events = pendingRes.value.data.events_data as KeyEvent[];
  }

  // cover_ar_tx_id 非法时降级 coverUrl=''：OG 走"无封面"色块，详情页 <img> 显示 broken
  // image 但不会整页崩；相比直接抛错让 OG 500，UX 更稳
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
    events,
    track,
    coverUrl,
    txHash: queue.tx_hash ?? undefined,
    etherscanUrl: queue.tx_hash
      ? `${ETHERSCAN_BASE}/${queue.tx_hash}`
      : undefined,
    mintedAt: queue.created_at,
    eventCount: events.length,
  };
}
