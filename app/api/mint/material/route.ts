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

    // 2. 解析请求体（只认 tokenId，idempotencyKey 后端自己合成稳定值防并发）
    const body = await req.json();
    const { tokenId } = body as { tokenId: number };

    if (!tokenId || !Number.isInteger(tokenId)) {
      return NextResponse.json({ error: '缺少或非法 tokenId' }, { status: 400 });
    }

    const userId = auth.userId;

    // 3. 同一用户 + 同一素材不重复铸造（success 已存在 → 明确 409）
    const { data: alreadyMinted } = await supabaseAdmin
      .from('mint_events')
      .select('id')
      .eq('user_id', userId)
      .eq('token_id', tokenId)
      .limit(1)
      .maybeSingle();

    if (alreadyMinted) {
      return NextResponse.json({ error: '你已经铸造过这个素材', alreadyMinted: true }, { status: 409 });
    }

    // 4. 合成稳定 idempotencyKey — 防止并发重复入队的核心
    // 靠 mint_queue UNIQUE(idempotency_key) 把并发两次收藏压到一次插入
    const idempotencyKey = `mint-${userId}-${tokenId}`;

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
      // unique 冲突 = 已有同 (user,token) 的 job — 按状态/失败类型分流
      if (mintError.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('mint_queue')
          .select('id, status, failure_kind')
          .eq('idempotency_key', idempotencyKey)
          .single();
        if (!existing) throw mintError;

        // pending / minting_onchain / success 走原语义
        if (existing.status === 'success') {
          return NextResponse.json(
            { error: '你已经铸造过这个素材', alreadyMinted: true },
            { status: 409 },
          );
        }
        if (existing.status === 'pending' || existing.status === 'minting_onchain') {
          return NextResponse.json({ result: 'ok', mintId: existing.id, status: existing.status });
        }

        // status === 'failed' — 按 failure_kind 分流（Phase 6 A2）
        if (existing.failure_kind === 'safe_retry') {
          // CAS reset 防并发：只有还在 failed 才能 reset
          const { data: reset } = await supabaseAdmin
            .from('mint_queue')
            .update({
              status: 'pending',
              tx_hash: null,
              retry_count: 0,
              failure_kind: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .eq('status', 'failed')
            .select('id')
            .maybeSingle();
          if (reset) {
            return NextResponse.json({
              result: 'ok',
              mintId: existing.id,
              status: 'pending',
              retried: true,
            });
          }
          // 并发被别人抢先 reset；当作 ok 返回
          return NextResponse.json({ result: 'ok', mintId: existing.id, status: 'pending' });
        }

        // failure_kind = 'manual_review' 或 NULL（旧数据保守视同 manual_review）
        return NextResponse.json(
          {
            error: '上次铸造未完成，需人工核查',
            alreadyMinted: false,
            needsReview: true,
          },
          { status: 409 },
        );
      }
      throw mintError;
    }

    return NextResponse.json({ result: 'ok', mintId: mint.id, status: 'pending' });
  } catch (err) {
    console.error('POST /api/mint/material error:', err);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
