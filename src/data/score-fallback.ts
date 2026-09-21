import 'server-only';
import { createPublicClient, http } from 'viem';
import { CURRENT_CHAIN } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';

const readClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

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
