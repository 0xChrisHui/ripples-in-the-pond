import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';

/**
 * POST /api/mint/material
 * 前端调用 → 验证身份 → 写一条 pending 记录到 mint_queue → 立刻返回
 * 不在这里调合约（由 cron 异步处理）
 */

export async function POST(req: NextRequest) {
  try {
    // 1. 统一身份验证（含自动创建用户）
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await req.json();
    const { tokenId, idempotencyKey } = body as {
      tokenId: number;
      idempotencyKey: string;
    };

    if (!tokenId || !idempotencyKey) {
      return NextResponse.json({ error: '缺少 tokenId 或 idempotencyKey' }, { status: 400 });
    }

    const userId = auth.userId;

    // 3. 同一用户 + 同一素材不重复铸造
    const { data: alreadyMinted } = await supabaseAdmin
      .from('mint_events')
      .select('id')
      .eq('user_id', userId)
      .eq('token_id', tokenId)
      .limit(1)
      .single();

    if (alreadyMinted) {
      return NextResponse.json({ error: '你已经铸造过这个素材', alreadyMinted: true }, { status: 409 });
    }

    // 也检查队列里是否已有 pending/minting 的请求
    const { data: alreadyQueued } = await supabaseAdmin
      .from('mint_queue')
      .select('id')
      .eq('user_id', userId)
      .eq('token_id', tokenId)
      .in('status', ['pending', 'minting_onchain'])
      .limit(1)
      .single();

    if (alreadyQueued) {
      return NextResponse.json({ result: 'ok', mintId: alreadyQueued.id });
    }

    // 5. 直接插入，靠 unique(idempotency_key) 做幂等（修复：并发安全）
    const { data: mint, error: mintError } = await supabaseAdmin
      .from('mint_queue')
      .insert({
        idempotency_key: idempotencyKey,
        user_id: userId,
        mint_type: 'material',
        token_id: tokenId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (mintError) {
      // unique 冲突 = 重复请求，查出已有记录返回
      if (mintError.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('mint_queue')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .single();
        if (existing) {
          return NextResponse.json({ result: 'ok', mintId: existing.id });
        }
      }
      throw mintError;
    }

    return NextResponse.json({ result: 'ok', mintId: mint.id });
  } catch (err) {
    console.error('POST /api/mint/material error:', err);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
