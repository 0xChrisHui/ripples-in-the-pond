import { supabaseAdmin } from '@/src/lib/supabase';
import { requireSelfMintContext, selfMintErrorResponse } from '@/src/lib/self-mint/access';

const ORDER_ID = /^0x[0-9a-f]{64}$/;
const DIGEST = /^0x[0-9a-f]{64}$/;

async function parse(request: Request) {
  return request.json() as Promise<{
    orderId?: unknown;
    digest?: unknown;
    walletAddress?: unknown;
    outcome?: unknown;
  }>;
}

export async function POST(request: Request) {
  try {
    const body = await parse(request);
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)
      || typeof body.digest !== 'string' || !DIGEST.test(body.digest)) {
      return Response.json({ error: 'attempt 参数无效', code: 'INVALID_ATTEMPT' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.rpc('mark_score_self_mint_attempt', {
      p_user_id: context.userId, p_order_id: body.orderId, p_digest: body.digest,
    });
    if (error) {
      return Response.json({
        error: '订单已存在发送记录，请先等待核验', code: 'ATTEMPT_CONFLICT',
      }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parse(request);
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)
      || typeof body.digest !== 'string' || !DIGEST.test(body.digest)
      || (body.outcome !== 'rejected' && body.outcome !== 'unknown')) {
      return Response.json({ error: 'attempt 结果无效', code: 'INVALID_ATTEMPT' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.rpc('resolve_score_self_mint_attempt', {
      p_user_id: context.userId,
      p_order_id: body.orderId,
      p_digest: body.digest,
      p_rejected: body.outcome === 'rejected',
    });
    if (error) {
      return Response.json({
        error: '发送状态已发生变化', code: 'ATTEMPT_RESOLUTION_CONFLICT',
      }, { status: 409 });
    }
    return Response.json({
      ok: true,
      status: body.outcome === 'rejected' ? 'ready_to_sign' : 'manual_review',
    });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
