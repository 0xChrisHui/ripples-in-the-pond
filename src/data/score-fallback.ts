import 'server-only';
import { createPublicClient, http } from 'viem';
import { CURRENT_CHAIN } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';
import { createScoreProvenance, loadScoreMetadata } from './score/metadata';
import type { ScoreFailedData, ScorePageData, ScoreReadyData } from './score-source';

const readClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

async function readTokenUri(tokenId: number): Promise<string | null> {
  try {
    const value = await readClient.readContract({
      address: SCORE_NFT_ADDRESS, abi: SCORE_NFT_ABI,
      functionName: 'tokenURI', args: [BigInt(tokenId)],
    });
    return typeof value === 'string' && value.startsWith('ar://') ? value : null;
  } catch (error) {
    console.error('[score-fallback] tokenURI read failed:', tokenId, error);
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

function metadataFailure(tokenId: number, tokenUri: string, holder: string | null): ScoreFailedData {
  return {
    state: 'failed', source: 'chain', id: String(tokenId), queueId: null, tokenId,
    queueStatus: null, trackTitle: `Ripples #${tokenId}`, creatorAddress: '',
    currentHolder: holder, coverUrl: '', eventCount: null, permanentEventCount: null,
    createdAt: null, confirmedAt: null, mintedAt: '', degraded: true,
    publicFailure: 'metadata_unavailable', failureKind: null,
    provenance: createScoreProvenance({
      contract: SCORE_NFT_ADDRESS, tokenId, holder, creator: null, mintTx: null,
      setUriTx: null, metadataRef: tokenUri, manifest: null,
    }),
  };
}

/** DB miss 时只从 OP tokenURI 与永久 metadata 重建，不拼接当前环境资源。 */
export async function getScoreFromChain(tokenId: number): Promise<ScorePageData | null> {
  const tokenUri = await readTokenUri(tokenId);
  if (!tokenUri) return null;
  const holder = await getScoreOwner(tokenId);
  try {
    const metadata = await loadScoreMetadata(tokenUri);
    if (metadata.eventCount == null) throw new Error('永久 metadata 缺少事件数');
    const ready: ScoreReadyData = {
      state: 'ready', source: 'chain', id: String(tokenId), queueId: null, tokenId,
      queueStatus: null, trackTitle: metadata.trackTitle ?? metadata.name ?? `Ripples #${tokenId}`,
      creatorAddress: '', currentHolder: holder, coverUrl: metadata.coverUrl ?? '',
      eventCount: metadata.eventCount, permanentEventCount: metadata.eventCount,
      createdAt: null, confirmedAt: null, mintedAt: metadata.mintedAt ?? '',
      degraded: true, metadataRef: metadata.metadataRef, manifest: metadata.manifest,
      provenance: createScoreProvenance({
        contract: SCORE_NFT_ADDRESS, tokenId, holder, creator: null, mintTx: null,
        setUriTx: null, metadataRef: metadata.metadataRef, manifest: metadata.manifest,
      }),
    };
    return ready;
  } catch (error) {
    console.error('[score-fallback] permanent metadata invalid:', tokenId, error);
    return metadataFailure(tokenId, tokenUri, holder);
  }
}
