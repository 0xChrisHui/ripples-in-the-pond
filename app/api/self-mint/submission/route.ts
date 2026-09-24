import { supabaseAdmin } from '@/src/lib/supabase';
import { requireSelfMintContext, selfMintErrorResponse } from '@/src/lib/self-mint/access';
import type { SelfMintOrderRow } from '@/src/lib/self-mint/order';

const ORDER_ID = /^0x[0-9a-f]{64}$/;
const HASH = /^0x[0-9a-f]{64}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      orderId?: unknown;
      digest?: unknown;
      txHash?: unknown;
      walletAddress?: unknown;
    };
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)
      || typeof body.digest !== 'string' || !HASH.test(body.digest)
      || typeof body.txHash !== 'string' || !HASH.test(body.txHash)) {
      return Response.json({ error: '交易登记参数无效', code: 'INVALID_SUBMISSION' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from('score_self_mint_orders')
      .select('*').eq('order_id', body.orderId).eq('user_id', context.userId).single();
    if (error || !data) {
      return Response.json({ error: '订单不存在', code: 'ORDER_NOT_FOUND' }, { status: 404 });
    }
    const row = data as SelfMintOrderRow;
    if (row.recipient_address.toLowerCase() !== context.walletAddress.toLowerCase()) {
      return Response.json({ error: '当前钱包不是订单接收人', code: 'WALLET_CHANGED' }, { status: 409 });
    }

    const { data: submitted, error: submitError } = await supabaseAdmin.rpc(
      'submit_score_self_mint_transaction',
      {
        p_user_id: context.userId,
        p_order_id: body.orderId,
        p_digest: body.digest,
        p_tx_hash: body.txHash,
      },
    );
    if (submitError) {
      return Response.json({ error: '交易登记冲突', code: 'SUBMISSION_CONFLICT' }, { status: 409 });
    }
    return Response.json({ ok: true, status: submitted?.status ?? 'submitted', txHash: body.txHash });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
