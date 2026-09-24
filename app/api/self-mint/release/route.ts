import { supabaseAdmin } from '@/src/lib/supabase';
import { requireSelfMintContext, selfMintErrorResponse } from '@/src/lib/self-mint/access';

const ORDER_ID = /^0x[0-9a-f]{64}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderId?: unknown; walletAddress?: unknown };
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)) {
      return Response.json({ error: '订单编号无效', code: 'INVALID_ORDER' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.rpc('release_score_self_mint_claim', {
      p_user_id: context.userId,
      p_order_id: body.orderId,
      p_reason: '用户在链上明确失败并完成清查后重新选择',
    });
    if (error) {
      return Response.json({
        error: '订单仍可能存在链上结果，暂不能重新选择', code: 'UNSAFE_CLAIM_RELEASE',
      }, { status: 409 });
    }
    return Response.json({ ok: true, status: 'released' });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
