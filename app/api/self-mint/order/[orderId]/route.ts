import { supabaseAdmin } from '@/src/lib/supabase';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { selfMintErrorResponse } from '@/src/lib/self-mint/access';
import { publicOrder, type SelfMintOrderRow } from '@/src/lib/self-mint/order';

const ORDER_ID = /^0x[0-9a-f]{64}$/;

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const walletAddress = new URL(request.url).searchParams.get('walletAddress');
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: '未登录', code: 'UNAUTHENTICATED' }, { status: 401 });
    if (!ORDER_ID.test(orderId)) {
      return Response.json({ error: '订单编号无效', code: 'INVALID_ORDER' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from('score_self_mint_orders')
      .select('*').eq('order_id', orderId).eq('user_id', auth.userId).single();
    if (error || !data) {
      return Response.json({ error: '订单不存在', code: 'ORDER_NOT_FOUND' }, { status: 404 });
    }
    const row = data as SelfMintOrderRow;
    return Response.json({
      ...publicOrder(row),
      canContinue: typeof walletAddress === 'string'
        && row.recipient_address.toLowerCase() === walletAddress.toLowerCase(),
    });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
