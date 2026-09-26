import assert from 'node:assert/strict';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, getAddress, http, parseAbi, type Hex } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

loadEnvConfig(process.cwd());

type Order = {
  order_id: Hex;
  chain_id: number;
  score_contract: string;
  token_id: number;
};

const chainId = Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
assert.ok(chainId === 1 || chainId === 11155111, '当前 Ethereum Score chainId 无效');
const contract = getAddress(process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS!).toLowerCase();
const rpcUrl = process.env.ETHEREUM_RPC_URL;
assert.ok(rpcUrl, 'ETHEREUM_RPC_URL 未配置');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const client = createPublicClient({
  chain: chainId === 1 ? mainnet : sepolia,
  transport: http(rpcUrl),
});
const orderMappingAbi = parseAbi(['function tokenIdByOrderId(bytes32 orderId) view returns (uint256)']);

async function main() {
  const { data, error } = await supabase.from('score_self_mint_orders')
    .select('order_id,chain_id,score_contract,token_id')
    .eq('chain_id', chainId)
    .eq('score_contract', contract)
    .order('token_id');
  if (error) throw error;
  const orders = (data ?? []) as Order[];
  const dbIds = orders.map(({ token_id }) => BigInt(token_id));
  const dbMax = dbIds.reduce((max, value) => value > max ? value : max, 0n);

  // 每次链上铸造都必须携带服务端订单凭证；逐订单读取 mapping 可覆盖 hash 漏报路径，
  // 也避免免费 RPC 对大范围 eth_getLogs 的限制。
  const mapped = await Promise.all(orders.map(({ order_id }) => client.readContract({
    address: getAddress(contract), abi: orderMappingAbi,
    functionName: 'tokenIdByOrderId', args: [order_id],
  })));
  const chainIds = mapped.filter((tokenId) => tokenId > 0n);
  const chainMax = chainIds.reduce((max, value) => value > max ? value : max, 0n);
  assert.ok(chainMax <= dbMax, '链上存在数据库未覆盖的更大 Token ID，禁止自动初始化计数器');

  const counterResult = await supabase.from('score_self_mint_token_counters')
    .select('next_token_id')
    .eq('chain_id', chainId)
    .eq('score_contract', contract)
    .maybeSingle();
  if (counterResult.error && !['42P01', 'PGRST205'].includes(counterResult.error.code)) {
    throw counterResult.error;
  }
  const counter = counterResult.data as { next_token_id: number } | null;
  const expectedNext = (dbMax > chainMax ? dbMax : chainMax) + 1n;
  if (counter) {
    assert.ok(BigInt(counter.next_token_id) >= expectedNext, '集合计数器落后于既有编号');
  }

  console.log(JSON.stringify({
    chainId,
    contract,
    database: { orders: orders.length, maxTokenId: dbMax.toString() },
    chain: { redeemed: chainIds.length, maxTokenId: chainMax.toString() },
    counter: counter ? { nextTokenId: String(counter.next_token_id), ready: true }
      : { nextTokenId: expectedNext.toString(), ready: false },
  }, null, 2));
}

void main().catch((caught: unknown) => {
  const message = caught instanceof Error ? caught.message
    : typeof caught === 'object' && caught && 'message' in caught ? String(caught.message)
      : '编号审计失败';
  console.error(message);
  process.exitCode = 1;
});
