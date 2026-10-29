import { requireSelfMintContext } from '@/src/lib/self-mint/access';
import { findOrderById, publicPackOrder, transitionOrder } from '@/src/lib/score-pack/orders';
import { badRequest, isTxHash, packErrorResponse } from '../_shared';

/** ETH：用户钱包广播后上报 hash，只是加速提示；真值仍由 cron 按 PackOpened 事件对账。 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !isTxHash(body.txHash)) return badRequest('INVALID_SUBMISSION');
    const order = await findOrderById(body.orderId);
    if (!order || order.user_id !== context.userId || order.mode !== 'eth_self_paid') {
      return Response.json({ error: 'ORDER_NOT_FOUND', code: 'ORDER_NOT_FOUND' }, { status: 404 });
    }
    if (order.status === 'awaiting_wallet') {
      const next = await transitionOrder(order.id, 'awaiting_wallet', 'submitted_unknown', {
        tx_hash: body.txHash.toLowerCase(),
      });
      return Response.json({ order: publicPackOrder(next ?? order) });
    }
    return Response.json({ order: publicPackOrder(order) });
  } catch (error) {
    return packErrorResponse(error);
  }
}
