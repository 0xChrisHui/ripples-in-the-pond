import { randomUUID } from 'node:crypto';
import { getAddress, parseAbiItem, type Address, type Hex } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import { operatorWalletClient, publicClient } from '@/src/lib/chain/operator-wallet';
import { acquireOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
import { WALLET_RECIPE_ABI } from '@/src/lib/chain/wallet-recipe-contract';
import { decideMintAction } from '@/src/features/wallet-recipe/pipeline-policy';
import { PipelineStepError, type PipelineStepResult, type WalletRecipeQueueRow } from './shared';

const mintedEvent = parseAbiItem(
  'event WalletRecipeMinted(address indexed origin, uint256 indexed tokenId)',
);

function attemptedAgeMs(row: WalletRecipeQueueRow): number | null {
  return row.mint_attempted_at
    ? Math.max(0, Date.now() - new Date(row.mint_attempted_at).getTime())
    : null;
}

async function readOriginState(row: WalletRecipeQueueRow, contract: Address) {
  const tokenId = await publicClient.readContract({
    address: contract, abi: WALLET_RECIPE_ABI, functionName: 'tokenIdByOrigin',
    args: [row.origin_wallet],
  });
  if (tokenId === 0n) return { tokenId, matches: true };
  const [origin, tokenUri, owner] = await Promise.all([
    publicClient.readContract({
      address: contract, abi: WALLET_RECIPE_ABI, functionName: 'originWalletOf', args: [tokenId],
    }),
    publicClient.readContract({
      address: contract, abi: WALLET_RECIPE_ABI, functionName: 'tokenURI', args: [tokenId],
    }),
    publicClient.readContract({
      address: contract, abi: WALLET_RECIPE_ABI, functionName: 'ownerOf', args: [tokenId],
    }),
  ]);
  // owner 允许因转让变化；读取成功本身证明 token 仍存在，origin 与永久 URI 才是恢复真值。
  void owner;
  return {
    tokenId,
    matches: origin.toLowerCase() === row.origin_wallet_key && tokenUri === row.token_uri,
  };
}

async function findMintTx(row: WalletRecipeQueueRow, contract: Address, tokenId: bigint) {
  const logs = await publicClient.getLogs({
    address: contract,
    event: mintedEvent,
    args: { origin: row.origin_wallet, tokenId },
    fromBlock: BigInt(row.source_score_block),
    toBlock: 'latest',
  });
  if (logs.length !== 1 || !logs[0].transactionHash) {
    throw new PipelineStepError('origin 已铸但无法唯一恢复 mint 交易', 'manual_review');
  }
  return logs[0].transactionHash;
}

async function saveChainFacts(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  facts: { txHash: Hex; tokenId?: bigint; stamp?: string },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('wallet_recipe_queue').update({
    tx_hash: facts.txHash,
    ...(facts.tokenId ? { token_id: Number(facts.tokenId) } : {}),
    ...(facts.stamp ? { mint_attempted_at: facts.stamp } : {}),
    updated_at: now,
  }).eq('id', row.id).eq('locked_by', leaseOwner).gt('lease_expires_at', now)
    .select('id').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function broadcastMint(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  contract: Address,
  deadlineAt: number,
): Promise<PipelineStepResult> {
  if (deadlineAt - Date.now() < 12_000) {
    return { status: 'minting_onchain', detail: 'response_deadline', failureKind: 'transient' };
  }
  const simulation = await publicClient.simulateContract({
    account: operatorWalletClient.account,
    address: contract,
    abi: WALLET_RECIPE_ABI,
    functionName: 'mintToOrigin',
    args: [row.origin_wallet, row.token_uri as string],
  });
  if (deadlineAt - Date.now() < 8_000) {
    return { status: 'minting_onchain', detail: 'response_deadline', failureKind: 'transient' };
  }
  const stamp = new Date().toISOString();
  const { data: stamped, error: stampError } = await supabaseAdmin.from('wallet_recipe_queue')
    .update({ mint_attempted_at: stamp, updated_at: stamp })
    .eq('id', row.id).eq('locked_by', leaseOwner).is('mint_attempted_at', null)
    .gt('lease_expires_at', stamp).select('id').maybeSingle();
  if (stampError) throw stampError;
  if (!stamped) return { status: 'minting_onchain', detail: 'attempt_stamp_lost' };

  const holder = `wallet-recipe-${randomUUID()}`;
  if (!(await acquireOpLock(holder))) {
    const now = new Date().toISOString();
    await supabaseAdmin.from('wallet_recipe_queue')
      .update({ mint_attempted_at: null, updated_at: now })
      .eq('id', row.id).eq('locked_by', leaseOwner).eq('mint_attempted_at', stamp)
      .is('tx_hash', null).gt('lease_expires_at', now);
    return { status: 'minting_onchain', detail: 'operator_busy', failureKind: 'transient' };
  }
  let txHash: Hex;
  try {
    try {
      txHash = await operatorWalletClient.writeContract(simulation.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PipelineStepError(`mint 广播结果待链上恢复：${message}`, 'transient');
    }
  } finally {
    await releaseOpLock(holder);
  }
  if (!(await saveChainFacts(row, leaseOwner, { txHash }))) {
    throw new PipelineStepError(`mint ${txHash} 已广播但 DB hash 写入失败`, 'manual_review');
  }
  return { status: 'confirming_onchain', detail: 'mint_broadcast' };
}

async function inspectReceipt(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  contract: Address,
  txHash: Hex,
  deadlineAt: number,
): Promise<PipelineStepResult> {
  if (deadlineAt - Date.now() < 12_000) {
    return { status: 'confirming_onchain', detail: 'response_deadline', failureKind: 'transient' };
  }
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    const action = decideMintAction({
      chainTokenId: 0n, chainStateMatches: true, txHash,
      attemptedAgeMs: attemptedAgeMs(row), receipt: 'pending', confirmations: 0n,
    });
    if (action === 'manual_review') {
      throw new PipelineStepError('mint receipt 超过 30 分钟仍未定案', 'manual_review');
    }
    return { status: 'confirming_onchain', detail: 'receipt_pending', failureKind: 'transient' };
  }
  if (receipt.status !== 'success') {
    throw new PipelineStepError(`mint 交易已 revert：${txHash}`, 'contract_rejected');
  }
  const state = await readOriginState(row, contract);
  if (state.tokenId === 0n || !state.matches) {
    throw new PipelineStepError('receipt 成功但 origin/tokenURI 无法对账', 'manual_review');
  }
  if (!(await saveChainFacts(row, leaseOwner, { txHash, tokenId: state.tokenId }))) {
    return { status: 'confirming_onchain', detail: 'lease_lost' };
  }
  const head = await publicClient.getBlockNumber();
  const confirmations = head >= receipt.blockNumber ? head - receipt.blockNumber + 1n : 0n;
  const action = decideMintAction({
    chainTokenId: 0n, chainStateMatches: true, txHash,
    attemptedAgeMs: attemptedAgeMs(row), receipt: 'success', confirmations,
  });
  return action === 'success'
    ? { status: 'success', detail: `confirmed_${confirmations}` }
    : { status: 'confirming_onchain', detail: `confirmations_${confirmations}`, failureKind: 'transient' };
}

export async function stepMintOnchain(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  contractInput: Address,
  deadlineAt: number,
): Promise<PipelineStepResult> {
  if (!row.token_uri || row.metadata_upload_state !== 'verified') {
    throw new PipelineStepError('mint 前 metadata 尚未验证', 'permanent_input');
  }
  const contract = getAddress(contractInput);
  const state = await readOriginState(row, contract);
  const action = decideMintAction({
    chainTokenId: state.tokenId,
    chainStateMatches: state.matches,
    txHash: row.tx_hash,
    attemptedAgeMs: attemptedAgeMs(row),
    receipt: 'unchecked',
    confirmations: 0n,
  });
  if (action === 'manual_review' && state.tokenId > 0n) {
    throw new PipelineStepError('origin 链上状态与队列不一致', 'manual_review');
  }
  if (action === 'recover_success') {
    const txHash = row.tx_hash as Hex | null
      ?? await findMintTx(row, contract, state.tokenId);
    const stamp = row.mint_attempted_at ?? new Date().toISOString();
    if (!(await saveChainFacts(row, leaseOwner, { txHash, tokenId: state.tokenId, stamp }))) {
      return { status: row.status, detail: 'lease_lost' };
    }
    return inspectReceipt(
      { ...row, mint_attempted_at: stamp }, leaseOwner, contract, txHash, deadlineAt,
    );
  }
  if (action === 'wait_attempt') {
    return { status: 'minting_onchain', detail: 'attempted_without_hash', failureKind: 'transient' };
  }
  if (action === 'manual_review') {
    throw new PipelineStepError('mint attempted 超过 25 分钟且无 tx hash', 'manual_review');
  }
  if (action === 'broadcast') return broadcastMint(row, leaseOwner, contract, deadlineAt);
  return inspectReceipt(row, leaseOwner, contract, row.tx_hash as Hex, deadlineAt);
}
