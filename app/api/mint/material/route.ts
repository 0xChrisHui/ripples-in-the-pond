import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { supabaseAdmin } from '@/src/lib/supabase';

/**
 * POST /api/mint/material
 * 前端调用 → 验证身份 → 写一条 pending 记录到 mint_queue → 立刻返回
 * 不在这里调合约（由 cron 异步处理）
 */

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export async function POST(req: NextRequest) {
  try {
    // 1. 从 Authorization header 拿 token 并验证
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少 Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const claims = await privy.verifyAuthToken(token);
    const privyUserId = claims.userId;

    // 2. 解析请求体
    const body = await req.json();
    const { tokenId, idempotencyKey } = body as {
      tokenId: number;
      idempotencyKey: string;
    };

    if (!tokenId || !idempotencyKey) {
      return NextResponse.json({ error: '缺少 tokenId 或 idempotencyKey' }, { status: 400 });
    }

    // 3. 查找或创建用户
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, evm_address')
      .eq('privy_user_id', privyUserId)
      .single();

    let userId: string;
    let evmAddress: string;

    if (existingUser) {
      userId = existingUser.id;
      evmAddress = existingUser.evm_address;
    } else {
      // 首次铸造，从 Privy 拿用户信息并创建记录
      const privyUser = await privy.getUser(privyUserId);
      const wallet = privyUser.wallet;
      if (!wallet) {
        return NextResponse.json({ error: '用户没有钱包' }, { status: 400 });
      }
      evmAddress = wallet.address;

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({ evm_address: evmAddress, privy_user_id: privyUserId })
        .select('id')
        .single();

      if (insertError) {
        // unique 冲突说明并发创建，重新查一次
        const { data: retry } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('privy_user_id', privyUserId)
          .single();
        if (!retry) throw insertError;
        userId = retry.id;
      } else {
        userId = newUser.id;
      }
    }

    // 4. 同一用户 + 同一素材不重复铸造
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
