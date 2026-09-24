import 'server-only';

import { cache } from 'react';
import { getAddress, type Address } from 'viem';
import {
  getScoreById,
  type ScoreFailedData,
  type ScorePageData,
  type ScoreReadyData,
} from '@/src/data/score-source';
import { getChainPublicClient } from '@/src/lib/chain/multichain/public-client';
import {
  buildAssetId,
  explorerTxUrlFor,
  getChainDefinition,
  getConfiguredScoreAddress,
  type SupportedChainId,
} from '@/src/lib/chain/multichain/registry';
import { ETHEREUM_SCORE_ABI } from '@/src/lib/self-mint/ethereum-score-contract';
import { supabaseAdmin } from '@/src/lib/supabase';
import { createScoreProvenance } from './metadata';
import { getActiveScoreSnapshot } from './snapshot-source';

type SelfMintRecord = {
  order_id: string;
  tx_hash: string | null;
  replacement_tx_hash: string | null;
  recipient_address: string;
  created_at: string;
  confirmed_at: string | null;
};

export type MultichainScoreData = ScorePageData & {
  chainId: SupportedChainId;
  contractAddress: Address;
};

async function readEthereumScore(
  chainId: 1 | 11155111,
  contract: `0x${string}`,
  tokenId: number,
): Promise<MultichainScoreData | null> {
  const client = getChainPublicClient(chainId);
  let owner: string;
  let tokenUri: string;
  try {
    [owner, tokenUri] = await Promise.all([
      client.readContract({ address: contract, abi: ETHEREUM_SCORE_ABI, functionName: 'ownerOf', args: [BigInt(tokenId)] }),
      client.readContract({ address: contract, abi: ETHEREUM_SCORE_ABI, functionName: 'tokenURI', args: [BigInt(tokenId)] }),
    ]);
  } catch {
    return null;
  }
  if (!tokenUri.startsWith('ar://')) return null;

  const { data } = await supabaseAdmin.from('score_self_mint_orders')
    .select('order_id,tx_hash,replacement_tx_hash,recipient_address,created_at,confirmed_at')
    .eq('chain_id', chainId).eq('score_contract', contract.toLowerCase())
    .eq('token_id', tokenId).eq('status', 'success').maybeSingle();
  const record = data as SelfMintRecord | null;
  const txHash = record?.replacement_tx_hash ?? record?.tx_hash ?? null;
  const creator = record?.recipient_address ?? null;
  const provenance = (manifest: ScoreReadyData['manifest'] | null) => createScoreProvenance({
    contract, tokenId, holder: owner, creator,
    mintTx: txHash, setUriTx: null, metadataRef: tokenUri, manifest,
    explorerBaseUrl: getChainDefinition(chainId).explorerBaseUrl,
  });
  let snapshot: Awaited<ReturnType<typeof getActiveScoreSnapshot>>;
  try {
    snapshot = await getActiveScoreSnapshot(tokenId, { chainId, contract });
    if (!snapshot || snapshot.metadataRef !== tokenUri) throw new Error('verified snapshot 不可用');
  } catch (error) {
    console.error('[multichain-score] verified snapshot unavailable:', chainId, contract, tokenId, error);
    const failed: ScoreFailedData & {
      chainId: SupportedChainId;
      contractAddress: Address;
    } = {
      state: 'failed', source: record ? 'database' : 'chain',
      id: buildAssetId(chainId, contract, tokenId), queueId: record?.order_id ?? null,
      tokenId, queueStatus: null, chainId, contractAddress: contract,
      trackTitle: `Ripples #${tokenId}`, creatorAddress: creator ?? '', currentHolder: owner,
      coverUrl: '', eventCount: null, permanentEventCount: null,
      createdAt: record?.created_at ?? null, confirmedAt: record?.confirmed_at ?? null,
      mintedAt: record?.created_at ?? '', txHash: txHash ?? undefined,
      etherscanUrl: txHash ? explorerTxUrlFor(chainId, txHash) : undefined,
      degraded: true, publicFailure: 'snapshot_unavailable', failureKind: null,
      provenance: provenance(null),
    };
    return failed;
  }

  return {
    state: 'ready', source: record ? 'database' : 'chain',
    id: buildAssetId(chainId, contract, tokenId), queueId: record?.order_id ?? null,
    tokenId, queueStatus: null, chainId, contractAddress: contract,
    trackTitle: snapshot.trackTitle ?? snapshot.name ?? `Ripples #${tokenId}`,
    creatorAddress: creator ?? '', currentHolder: owner,
    coverUrl: snapshot.coverUrl, eventCount: snapshot.playbackBootstrap.events.length,
    permanentEventCount: snapshot.playbackBootstrap.events.length,
    createdAt: record?.created_at ?? null, confirmedAt: record?.confirmed_at ?? null,
    mintedAt: snapshot.mintedAt ?? record?.created_at ?? '',
    txHash: txHash ?? undefined,
    etherscanUrl: txHash ? explorerTxUrlFor(chainId, txHash) : undefined,
    degraded: !record, metadataRef: snapshot.metadataRef, manifest: snapshot.manifest,
    playbackBootstrap: snapshot.playbackBootstrap, snapshot: snapshot.receipt,
    provenance: provenance(snapshot.manifest),
  };
}

export const getMultichainScore = cache(async (
  chainValue: string,
  contractValue: string,
  tokenValue: string,
): Promise<MultichainScoreData | null> => {
  if (!/^\d+$/.test(chainValue) || !/^\d+$/.test(tokenValue)) return null;
  const chainId = Number(chainValue);
  const tokenId = Number(tokenValue);
  if (!Number.isSafeInteger(tokenId) || tokenId < 1) return null;
  let contract: `0x${string}`;
  try {
    getChainDefinition(chainId);
    contract = getAddress(contractValue);
    if (contract !== getConfiguredScoreAddress(chainId)) return null;
  } catch {
    return null;
  }

  if (chainId === 10 || chainId === 11155420) {
    const score = await getScoreById(String(tokenId));
    if (!score || score.state !== 'ready') return null;
    return { ...score, id: buildAssetId(chainId, contract, tokenId), chainId, contractAddress: contract };
  }
  return readEthereumScore(chainId as 1 | 11155111, contract, tokenId);
});
