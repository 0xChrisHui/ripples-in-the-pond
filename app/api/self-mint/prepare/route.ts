import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { getConfiguredScoreAddress, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import { supabaseAdmin } from '@/src/lib/supabase';
import { requireSelfMintContext, selfMintErrorResponse } from '@/src/lib/self-mint/access';
import { runSelfMintAssetOrder } from '@/src/lib/self-mint/asset-job';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { pendingScoreId?: unknown; walletAddress?: unknown };
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.pendingScoreId !== 'string' || !UUID.test(body.pendingScoreId)) {
      return Response.json({ error: '乐谱编号无效', code: 'INVALID_SCORE' }, { status: 400 });
    }
    const chainId = Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
    const chain = getChainDefinition(chainId);
    if (chain.scoreMintMode !== 'eth_self_paid' || !chain.allowsMintInitiation) {
      throw new Error('ETH 自付目标链尚未开放铸造');
    }
    const contract = getConfiguredScoreAddress(chainId);
    const orderId = `0x${randomBytes(32).toString('hex')}`;
    const { data, error } = await supabaseAdmin.rpc('prepare_score_self_mint_order', {
      p_user_id: context.userId,
      p_pending_score_id: body.pendingScoreId,
      p_chain_id: chainId,
      p_score_contract: contract.toLowerCase(),
      p_recipient_address: context.walletAddress.toLowerCase(),
      p_order_id: orderId,
    });
    if (error) {
      const message = error.message ?? '';
      if (message.includes('RATE_LIMITED')) {
        return Response.json({ error: '操作太频繁，请稍后再试', code: 'RATE_LIMITED' }, { status: 429 });
      }
      if (message.includes('MINT_CLAIM_CONFLICT') || message.includes('SELF_MINT_ORDER_CONFLICT')) {
        return Response.json({ error: '这段旋律已经选择了铸造方式', code: 'MINT_CLAIM_CONFLICT' }, { status: 409 });
      }
      if (message.includes('INVALID_SCORE')) {
        return Response.json({ error: '草稿不存在、已过期或不属于当前账号', code: 'INVALID_SCORE' }, { status: 400 });
      }
      if (message.includes('COVER_POOL_EMPTY')) {
        return Response.json({ error: '暂时无法准备封面，请稍后再试', code: 'COVER_POOL_EMPTY' }, { status: 503 });
      }
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('prepare RPC 未返回订单');
    after(async () => {
      try { await runSelfMintAssetOrder(row.order_id); }
      catch (caught) { console.error('[self-mint-assets]', caught); }
    });
    return Response.json({
      orderId: row.order_id,
      tokenId: String(row.token_id),
      status: row.status,
      chainId,
      scoreContract: contract,
    }, { status: 201 });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
