import 'server-only';
import { createPublicClient, http } from 'viem';
import { CURRENT_CHAIN } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';
import { resolveArUrl } from '@/src/lib/arweave';
import type { ScorePageData } from './score-source';

/**
 * P10-C 链上灾备（方案 a）：DB miss + 数字 tokenId 时，读链上 tokenURI + Arweave
 * metadata，返回降级 ScorePageData（无 track，带 animationUrl → 页面渲染 decoder iframe）。
 *
 * 用独立只读 publicClient（不碰 operator-wallet 私钥模块）；全 view call，不违
 * CONVENTIONS §3.1"前端不调合约"。任何一步失败 → 返 null（回到 notFound），
 * 灾备只锦上添花，不引入新崩溃面。
 */
const readClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

type Attr = { trait_type: string; value: string | number };

export async function getScoreFromChain(tokenId: number): Promise<ScorePageData | null> {
  try {
    const uri = (await readClient.readContract({
      address: SCORE_NFT_ADDRESS,
      abi: SCORE_NFT_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    })) as string;
    if (!uri?.startsWith('ar://')) return null;

    const resp = await fetch(resolveArUrl(uri.slice('ar://'.length)), {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const meta = await resp.json();
    if (!meta?.animation_url) return null;

    const attrs: Attr[] = Array.isArray(meta.attributes) ? meta.attributes : [];
    const attr = (t: string) => attrs.find((a) => a.trait_type === t)?.value;
    const track = attr('Track');
    const events = attr('Events');
    const minted = attr('Minted At');

    // ownerOf 失败不致命，creatorAddress 留空
    let creatorAddress = '';
    try {
      creatorAddress = (await readClient.readContract({
        address: SCORE_NFT_ADDRESS,
        abi: SCORE_NFT_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      })) as string;
    } catch {
      /* keep empty */
    }

    return {
      id: String(tokenId),
      tokenId,
      trackTitle: typeof track === 'string' ? track : (meta.name ?? `Ripples #${tokenId}`),
      creatorAddress,
      coverUrl: typeof meta.image === 'string' ? meta.image : '',
      mintedAt: typeof minted === 'string' ? minted : new Date(0).toISOString(),
      eventCount: typeof events === 'number' ? events : 0,
      animationUrl: meta.animation_url as string,
      degraded: true,
    };
  } catch (err) {
    console.error('[score-fallback] chain fallback failed:', tokenId, err);
    return null;
  }
}
