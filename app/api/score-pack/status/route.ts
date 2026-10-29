import { getAddress } from 'viem';
import { getConfiguredScoreAddress } from '@/src/lib/chain/multichain/registry';
import { readPackSnapshot } from '@/src/lib/score-pack/chain';
import { getPackChainConfig } from '@/src/lib/score-pack/contract';
import { findActiveOrder, publicPackOrder } from '@/src/lib/score-pack/orders';
import { badRequest, packErrorResponse, parseTarget } from '../_shared';

export const dynamic = 'force-dynamic';

/** 公开只读：链上真值（持有人、是否已开、TBA、余额）+ 进行中订单进度。 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const target = parseTarget({
      chainId: url.searchParams.get('chainId'), scoreContract: url.searchParams.get('contract'),
      tokenId: url.searchParams.get('tokenId'),
    });
    if (!target) return badRequest('INVALID_TARGET');
    const cfg = getPackChainConfig(target.chainId);
    if (!cfg) return Response.json({ enabled: false });
    if (getAddress(target.scoreContract) !== getConfiguredScoreAddress(target.chainId)) {
      return badRequest('WRONG_CONTRACT');
    }
    const [snapshot, order] = await Promise.all([
      readPackSnapshot(cfg, getAddress(target.scoreContract), target.tokenId),
      findActiveOrder(target.chainId, target.scoreContract, target.tokenId),
    ]);
    return Response.json({
      enabled: true, owner: snapshot.owner, opened: snapshot.opened, account: snapshot.account,
      accountDeployed: snapshot.accountDeployed, readAtBlock: snapshot.readAtBlock.toString(),
      contracts: { opener: cfg.opener, sounds: cfg.sounds, tracks: cfg.tracks },
      pack: snapshot.event && {
        txHash: snapshot.event.txHash, blockNumber: snapshot.event.blockNumber.toString(),
        trackTokenId: snapshot.event.trackTokenId.toString(),
        trackBalance: snapshot.trackBalance?.toString() ?? null,
        sounds: snapshot.soundBalances.map((s) => ({ id: s.id.toString(), balance: s.balance.toString() })),
      },
      order: order ? publicPackOrder(order) : null,
    });
  } catch (error) {
    return packErrorResponse(error);
  }
}
