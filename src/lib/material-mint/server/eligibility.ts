import 'server-only';
import { getAddress, type PublicClient } from 'viem';
import { MATERIAL_ABI } from '../contract';
import type { MaterialOrder } from '../types';
import { MaterialError, requireMaterialIssuancePolicy } from './policy';

/** 签发前读链上历史资格，转出后余额为零也不能再签新领取凭证。 */
export async function requireMaterialClaimAvailable(client: PublicClient, row: MaterialOrder) {
  requireMaterialIssuancePolicy();
  if (row.amount !== 1 || !/^[1-9][0-9]*$/.test(row.token_id) || ![1, 11155111].includes(row.chain_id)) {
    throw new MaterialError('原曲订单数量或网络无效', 'INVALID_ORDER', 400);
  }
  if (await client.getChainId() !== row.chain_id) throw new MaterialError('原曲RPC网络不符', 'RPC_CHAIN_MISMATCH', 503);
  const claimed = await client.readContract({ address: getAddress(row.contract_address), abi: MATERIAL_ABI,
    functionName: 'hasClaimed', args: [getAddress(row.recipient_address), BigInt(row.token_id)] });
  if (claimed) throw new MaterialError('这个钱包已经领取过这首原曲，转出后也不能再次领取', 'MATERIAL_ALREADY_CLAIMED');
}
