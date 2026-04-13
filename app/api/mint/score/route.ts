import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { resolveArUrl } from '@/src/lib/arweave';
import type { MintScoreRequest, MintScoreResponse } from '@/src/types/jam';

/**
 * POST /api/mint/score
 * 前端调用 → 验证身份 → 调 mint_score_enqueue RPC 原子入队 → 立刻返回
 * 不在这里上传 Arweave 或调合约（由 cron 异步处理 5 步状态机）
 *
 * 错误处理：
 *   429  RATE_LIMITED   过去 1 小时同一用户 ≥ 5 次
 *   400  INVALID_SCORE  pending_score 不存在 / 状态错 / 不属于用户
 *   503  COVER_POOL_EMPTY  封面池空（运营问题，需要补 score_covers）
 *   401  未登录
 *   500  其他
 */

export async function POST(req: NextRequest) {
  try {
    // 1. 统一身份验证
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 },
      );
    }

    // 2. 解析请求体 + UUID 格式校验
    const body = (await req.json()) as MintScoreRequest;
    const { pendingScoreId } = body;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!pendingScoreId || !uuidRe.test(pendingScoreId)) {
      return NextResponse.json(
        { error: '无效的 pendingScoreId' },
        { status: 400 },
      );
    }

    // 3. 调事务 RPC（封面分配 + 入队 + 草稿 expired 原子）
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'mint_score_enqueue',
      {
        p_user_id: auth.userId,
        p_pending_score_id: pendingScoreId,
      },
    );

    if (rpcError) {
      const msg = rpcError.message || '';
      console.error('mint_score_enqueue RPC error:', msg);

      if (msg.includes('RATE_LIMITED')) {
        return NextResponse.json(
          { error: '每小时最多铸造 5 次，请稍后再试' },
          { status: 429 },
        );
      }
      if (msg.includes('INVALID_SCORE')) {
        return NextResponse.json(
          { error: '草稿无效（不存在/已铸造/不属于你）' },
          { status: 400 },
        );
      }
      if (msg.includes('COVER_POOL_EMPTY')) {
        return NextResponse.json(
          { error: '暂时无法铸造，请稍后再试' },
          { status: 503 },
        );
      }
      throw rpcError;
    }

    // RPC 返回 table，取第一行
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row || !row.queue_id) {
      throw new Error('RPC 返回数据异常');
    }

    const coverArTxId: string = row.cover_ar_tx_id;
    const response: MintScoreResponse = {
      queueId: row.queue_id,
      coverArTxId,
      coverUrl: resolveArUrl(coverArTxId),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error('POST /api/mint/score error:', err);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
