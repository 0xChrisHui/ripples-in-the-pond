import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { SaveScoreRequest, SaveScoreResponse, KeyEvent } from '@/src/types/jam';

/**
 * POST /api/score/save
 * 用户演奏完成后上传草稿。必须登录。
 * - 资源上限：500 事件 / 60s / 100KB / 24h 内创作
 * - 同一 user+track 已有 draft → 旧的标记 expired，插入新的
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const MAX_EVENTS = 500;
const MAX_TIME_MS = 60_000;
const MAX_DURATION_MS = 5_000;
const MAX_BODY_KB = 100;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

/** 验证单个 KeyEvent 的字段范围 */
function isValidEvent(e: unknown): e is KeyEvent {
  if (typeof e !== 'object' || e === null) return false;
  const ev = e as Record<string, unknown>;
  return (
    typeof ev.key === 'string' &&
    /^[a-z]$/.test(ev.key) &&
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
    // 1. 验证登录
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少 Authorization header' }, { status: 401 });
    }
    const claims = await privy.verifyAuthToken(authHeader.slice(7));
    const privyUserId = claims.userId;

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
    if (now - createdMs > TTL_MS) {
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

    // 7. 查找用户
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('privy_user_id', privyUserId)
      .single();

    if (!user) {
      return NextResponse.json({ error: '用户不存在，请先登录' }, { status: 401 });
    }

    // 8. 验证 trackId 存在
    const { data: track } = await supabaseAdmin
      .from('tracks')
      .select('id')
      .eq('id', trackId)
      .single();

    if (!track) {
      return NextResponse.json({ error: '曲目不存在' }, { status: 400 });
    }

    // 9. 旧草稿标记为 expired
    await supabaseAdmin
      .from('pending_scores')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('track_id', trackId)
      .eq('status', 'draft');

    // 10. 插入新草稿
    const expiresAt = new Date(createdMs + TTL_MS).toISOString();
    const { data: score, error: insertError } = await supabaseAdmin
      .from('pending_scores')
      .insert({
        user_id: user.id,
        track_id: trackId,
        events_data: eventsData,
        status: 'draft',
        created_at: new Date(createdMs).toISOString(),
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError) {
      // 23505 = 唯一约束冲突，说明已有同一 user+track 的 draft，视为成功
      if (insertError.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('pending_scores')
          .select('id, expires_at')
          .eq('user_id', user.id)
          .eq('track_id', trackId)
          .eq('status', 'draft')
          .single();
        if (existing) {
          const res: SaveScoreResponse = {
            result: 'ok',
            scoreId: existing.id,
            expiresAt: existing.expires_at,
          };
          return NextResponse.json(res);
        }
      }
      throw insertError;
    }

    const res: SaveScoreResponse = {
      result: 'ok',
      scoreId: score.id,
      expiresAt,
    };
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    console.error('POST /api/score/save error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
