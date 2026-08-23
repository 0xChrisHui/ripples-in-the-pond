import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import type { SaveScoreRequest, SaveScoreResponse, KeyEvent } from '@/src/types/jam';
import { DRAFT_TTL_MS } from '@/src/lib/constants';

/**
 * POST /api/score/save
 * 用户演奏完成后上传草稿。必须登录。
 * - 资源上限：500 事件 / 60s / 100KB / 24h 内创作
 * - 同一 user+track 已有 draft → 旧的标记 expired，插入新的
 */

const MAX_EVENTS = 500;
const MAX_TIME_MS = 60_000;
const MAX_DURATION_MS = 5_000;
const MAX_BODY_KB = 100;
const VALID_KEY_RE = /^(?:[a-z]|[3-8]|space)$/;

/** 验证单个 KeyEvent 的字段范围 */
function isValidEvent(e: unknown): e is KeyEvent {
  if (typeof e !== 'object' || e === null) return false;
  const ev = e as Record<string, unknown>;
  return (
    typeof ev.key === 'string' &&
    VALID_KEY_RE.test(ev.key) &&
    typeof ev.time === 'number' &&
    ev.time >= 0 &&
    ev.time <= MAX_TIME_MS &&
    typeof ev.duration === 'number' &&
    ev.duration >= 0 &&
    ev.duration <= MAX_DURATION_MS
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1. 统一身份验证
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 2. 检查 body 大小（Content-Length 或序列化后检查）
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_KB * 1024) {
      return NextResponse.json({ error: '请求体超过 100KB 限制' }, { status: 400 });
    }

    // 3. 解析请求体
    const body: SaveScoreRequest = await req.json();
    const { trackId, eventsData, createdAt } = body;

    if (!trackId || !Array.isArray(eventsData) || !createdAt) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 4. 验证 createdAt 在 24h 内
    const createdMs = new Date(createdAt).getTime();
    if (isNaN(createdMs)) {
      return NextResponse.json({ error: 'createdAt 格式无效' }, { status: 400 });
    }
    const now = Date.now();
    if (createdMs > now + 60_000) {
      // 允许 1 分钟时钟偏差
      return NextResponse.json({ error: 'createdAt 不能在未来' }, { status: 400 });
    }
    if (now - createdMs > DRAFT_TTL_MS) {
      return NextResponse.json({ error: '草稿已过期（超过 24 小时）' }, { status: 400 });
    }

    // 5. 验证事件数量 + 每个事件的字段
    if (eventsData.length === 0) {
      return NextResponse.json({ error: '演奏数据不能为空' }, { status: 400 });
    }
    if (eventsData.length > MAX_EVENTS) {
      return NextResponse.json({ error: `事件数超过 ${MAX_EVENTS} 上限` }, { status: 400 });
    }
    for (const event of eventsData) {
      if (!isValidEvent(event)) {
        return NextResponse.json({ error: '事件数据格式无效' }, { status: 400 });
      }
    }

    // 6. 二次检查序列化大小
    const serialized = JSON.stringify(eventsData);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_KB * 1024) {
      return NextResponse.json({ error: '事件数据超过 100KB 限制' }, { status: 400 });
    }

    // 7. 验证 trackId 存在
    const { data: track } = await supabaseAdmin
      .from('tracks')
      .select('id')
      .eq('id', trackId)
      .single();

    if (!track) {
      return NextResponse.json({ error: '曲目不存在' }, { status: 400 });
    }

    // 9. 调原子 RPC（Phase 6 A4）：UPDATE 旧 draft → expired + INSERT 新 draft
    //    在一个事务内，insert 失败旧 draft 自动 rollback，不会丢草稿
    //    unique violation（并发场景）由 RPC 内 EXCEPTION 回退查现有 draft 返回
    const expiresAt = new Date(createdMs + DRAFT_TTL_MS).toISOString();
    const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc(
      'save_score_atomic',
      {
        p_user_id: auth.userId,
        p_track_id: trackId,
        p_events_data: eventsData,
        p_created_at: new Date(createdMs).toISOString(),
        p_expires_at: expiresAt,
      },
    );

    if (rpcError) {
      console.error('save_score_atomic RPC error:', rpcError);
      throw rpcError;
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.score_id) {
      throw new Error('save_score_atomic returned no row');
    }

    const res: SaveScoreResponse = {
      result: 'ok',
      scoreId: row.score_id,
      expiresAt: row.score_expires_at,
    };
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    console.error('POST /api/score/save error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
