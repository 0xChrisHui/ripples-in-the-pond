import { supabaseAdmin } from '@/src/lib/supabase';
import { getAddress } from 'viem';
import { getChainPublicClient } from '@/src/lib/chain/multichain/public-client';
import { requireSelfMintContext, selfMintErrorResponse } from '@/src/lib/self-mint/access';
import { ETHEREUM_SCORE_ABI } from '@/src/lib/self-mint/ethereum-score-contract';
import type { SelfMintOrderRow } from '@/src/lib/self-mint/order';
import { signMintAuthorization } from '@/src/lib/self-mint/voucher';

const ORDER_ID = /^0x[0-9a-f]{64}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderId?: unknown; walletAddress?: unknown };
    const context = await requireSelfMintContext(request, body.walletAddress);
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)) {
      return Response.json({ error: '订单编号无效', code: 'INVALID_ORDER' }, { status: 400 });
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
    if (!row.token_uri) {
      return Response.json({ error: '订单永久资源尚未就绪', code: 'ORDER_NOT_READY' }, { status: 409 });
    }
    const voucher = await signMintAuthorization(row);
    const { error: issueError } = await supabaseAdmin.rpc('issue_score_self_mint_authorization', {
      p_user_id: context.userId,
      p_order_id: row.order_id,
      p_digest: voucher.digest.toLowerCase(),
      p_uri_hash: voucher.authorization.tokenURIHash.toLowerCase(),
      p_deadline: Number(voucher.authorization.deadline),
      p_authorizer: voucher.account.address.toLowerCase(),
    });
    if (issueError) {
      if (issueError.message.includes('ORDER_NOT_AUTHORIZABLE')) {
        return Response.json({
          error: '订单尚未就绪或存在待核验交易', code: 'ORDER_NOT_AUTHORIZABLE',
        }, { status: 409 });
      }
      throw issueError;
    }
    const client = getChainPublicClient(row.chain_id);
    const args = [
      voucher.authorization, row.token_uri, voucher.account.address, voucher.signature,
    ] as const;
    const recipient = getAddress(context.walletAddress);
    const [gas, fees, balance] = await Promise.all([
      client.estimateContractGas({
        address: getAddress(row.score_contract), abi: ETHEREUM_SCORE_ABI,
        functionName: 'redeem', args, account: recipient,
      }),
      client.estimateFeesPerGas(),
      client.getBalance({ address: recipient }),
    ]);
    const gasLimit = gas * 120n / 100n;
    const maxFee = fees.maxFeePerGas ?? fees.gasPrice;
    if (!maxFee) throw new Error('暂时无法取得 Gas 价格');
    const estimatedFeeWei = gasLimit * maxFee;
    return Response.json({
      orderId: row.order_id,
      chainId: row.chain_id,
      scoreContract: row.score_contract,
      tokenUri: row.token_uri,
      authorizer: voucher.account.address,
      digest: voucher.digest,
      signature: voucher.signature,
      gasLimit: gasLimit.toString(),
      estimatedFeeWei: estimatedFeeWei.toString(),
      hasEnoughBalance: balance >= estimatedFeeWei,
      authorization: {
        ...voucher.authorization,
        tokenId: voucher.authorization.tokenId.toString(),
        deadline: Number(voucher.authorization.deadline),
      },
    });
  } catch (error) {
    return selfMintErrorResponse(error);
  }
}
