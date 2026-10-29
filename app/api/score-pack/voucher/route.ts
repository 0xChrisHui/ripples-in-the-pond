import { requireSelfMintContext } from '@/src/lib/self-mint/access';
import { issueSelfPaidVoucher } from '@/src/lib/score-pack/issue';
import { badRequest, packErrorResponse, parseTarget } from '../_shared';

/** ETH 自付：登录者必须是链上当前持有人；素材清单由服务端派生，不接受客户端提交。 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const target = parseTarget(body);
    if (!target || ![1, 11155111].includes(target.chainId)) return badRequest('INVALID_TARGET');
    const context = await requireSelfMintContext(request, body.walletAddress);
    const issued = await issueSelfPaidVoucher({
      ...target, userId: context.userId, holder: context.walletAddress, mode: 'eth_self_paid',
    });
    return Response.json(issued);
  } catch (error) {
    return packErrorResponse(error);
  }
}
