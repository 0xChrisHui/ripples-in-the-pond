import { getAddress } from 'viem';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { requestSponsoredPack } from '@/src/lib/score-pack/issue';
import { publicPackOrder } from '@/src/lib/score-pack/orders';
import { badRequest, packErrorResponse, parseTarget } from '../_shared';

/** OP 代付：只入队，由 cron 持锁签名并广播。 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: 'UNAUTHENTICATED', code: 'UNAUTHENTICATED' }, { status: 401 });
    const target = parseTarget(await request.json() as Record<string, unknown>);
    if (!target || ![10, 11155420].includes(target.chainId)) return badRequest('INVALID_TARGET');
    const order = await requestSponsoredPack({
      ...target, userId: auth.userId, holder: getAddress(auth.evmAddress), mode: 'op_sponsored',
    });
    return Response.json({ order: publicPackOrder(order) });
  } catch (error) {
    return packErrorResponse(error);
  }
}
