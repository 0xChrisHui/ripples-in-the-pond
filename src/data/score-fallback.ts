import 'server-only';
import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';
import { CURRENT_CHAIN } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';
import { LEGACY_SCORE_CONTRACT } from './score/legacy-identity';

const readClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});
const legacyReadClient = createPublicClient({ chain: optimism, transport: http() });

/** 旧数字 Score 的持有人只能从 OP 主网读取，不能误显示测试网同编号 NFT。 */
export async function getLegacyScoreOwner(tokenId: number): Promise<string | null> {
  try {
    return await legacyReadClient.readContract({
      address: LEGACY_SCORE_CONTRACT, abi: SCORE_NFT_ABI,
      functionName: 'ownerOf', args: [BigInt(tokenId)],
    });
  } catch (error) {
    console.error('[score-fallback] mainnet ownerOf read failed:', tokenId, error);
    return null;
  }
}

export async function getScoreOwner(tokenId: number): Promise<string | null> {
  try {
    return await readClient.readContract({
      address: SCORE_NFT_ADDRESS, abi: SCORE_NFT_ABI,
      functionName: 'ownerOf', args: [BigInt(tokenId)],
    }) as string;
  } catch (error) {
    console.error('[score-fallback] ownerOf read failed:', tokenId, error);
    return null;
  }
}
