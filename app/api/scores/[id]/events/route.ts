import { NextRequest, NextResponse } from 'next/server';
import { getScoreEvents } from '@/src/data/score-events-source';

/**
 * GET /api/scores/[id]/events
 *
 * 公开按需 events 端点（C9b）— /score/[id] 详情页 ScorePlayer 挂载时 fetch。
 * 路由 ID 双兼容：tokenId 数字 / queue.id UUID（同 /score/[id] 入口）。
 *
 * 与 /api/me/scores/[id]/events（私有，本人草稿）区分：
 *   - 这个：任何已铸造或在铸造中的 score，公开访问，按 queue.id 解析
 *   - /me/scores/[id]/events：仅本人未上链草稿，按 pending_scores.id 解析
 *
 * 公开访问与 /score/[id] 页面本身一致（middleware 注释：/api/scores/* 公开只读）。
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const events = await getScoreEvents(id);
    if (events === null) {
      return NextResponse.json({ error: 'Score 不存在' }, { status: 404 });
    }
    return NextResponse.json({ events });
  } catch (err) {
    console.error('GET /api/scores/[id]/events error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
