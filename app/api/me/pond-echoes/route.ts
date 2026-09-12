import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { publicClient } from '@/src/lib/chain/public-client';
import { getWalletRecipeAddress, WALLET_RECIPE_ABI } from '@/src/lib/chain/wallet-recipe-contract';
import { getOwnedEchoes } from '@/src/data/echo/source';
import type { EchoArchiveItem, MyEchoesResponse } from '@/src/data/echo/types';
import { formatPondEchoName } from '@/src/lib/wallet-recipe/metadata';
import { supabaseAdmin } from '@/src/lib/supabase';
import { ServerTiming } from '@/src/lib/performance/server-timing';
import type { WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';

type OriginRow = {
  status: WalletRecipeQueueStatus;
  token_id: number | null;
  token_uri: string | null;
  origin_wallet: string;
  last_error: string | null;
};

async function readOriginHistory(origin: string, timing: ServerTiming): Promise<{
  item: EchoArchiveItem | null;
  unavailable: boolean;
}> {
  let scoreContract: string;
  try { scoreContract = getAddress(SCORE_NFT_ADDRESS).toLowerCase(); } catch { return { item: null, unavailable: true }; }
  const { data, error } = await timing.measure('db', () => (
    supabaseAdmin.from('wallet_recipe_queue')
      .select('status,token_id,token_uri,origin_wallet,last_error')
      .eq('chain_id', CHAIN_ID_NUM).eq('source_score_contract', scoreContract)
      .eq('origin_wallet_key', origin.toLowerCase()).maybeSingle()
  ));
  if (error) return { item: null, unavailable: true };
  const row = data as OriginRow | null;
  if (!row) return { item: null, unavailable: false };
  let currentOwner: string | null = null;
  const contract = getWalletRecipeAddress();
  const tokenId = row.token_id;
  if (tokenId && contract) {
    try {
      currentOwner = await timing.measure('rpc', () => publicClient.readContract({
        address: contract, abi: WALLET_RECIPE_ABI,
        functionName: 'ownerOf', args: [BigInt(tokenId)],
      }));
    } catch { currentOwner = null; }
  }
  return {
    unavailable: false,
    item: {
      key: `origin:${row.token_id ?? origin.toLowerCase()}`,
      tokenId: row.token_id?.toString() ?? null,
      name: formatPondEchoName(row.origin_wallet),
      originWallet: row.origin_wallet,
      currentOwner,
      tokenUri: row.token_uri,
      status: row.status,
      relation: 'origin-history',
      hasError: Boolean(row.last_error),
    },
  };
}

/** 当前持有人由 ERC721Enumerable 决定；DB 只补 origin 的处理中/历史说明。 */
export async function GET(request: NextRequest) {
  const timing = new ServerTiming();
  try {
    const auth = await timing.measure('auth', () => authenticateRequest(request));
    if (!auth) return timing.response(() => NextResponse.json({ error: '未登录' }, { status: 401 }));
    let owner: string;
    try { owner = getAddress(auth.evmAddress); } catch {
      return timing.response(() => NextResponse.json({ error: '登录钱包地址无效' }, { status: 400 }));
    }
    const [owned, origin] = await Promise.all([
      timing.measure('rpc', () => getOwnedEchoes(owner)),
      readOriginHistory(owner, timing),
    ]);
    const ownedTokenIds = new Set(owned.items.map((item) => item.tokenId));
    const history = origin.item && !ownedTokenIds.has(origin.item.tokenId) ? [origin.item] : [];
    const body: MyEchoesResponse = {
      echoes: [...owned.items, ...history],
      onChainTotal: owned.total,
      truncated: owned.truncated,
      originStatusUnavailable: origin.unavailable,
    };
    return timing.response(() => NextResponse.json(body));
  } catch (error) {
    console.error('GET /api/me/pond-echoes error:', error);
    return timing.response(() => (
      NextResponse.json({ error: '池中回声链上档案暂不可用' }, { status: 503 })
    ));
  }
}
