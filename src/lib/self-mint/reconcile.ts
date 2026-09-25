import 'server-only';

import { getAddress, type Hex } from 'viem';
import { getChainPublicClient, getRequiredConfirmations } from '@/src/lib/chain/multichain/public-client';
import {
  getChainDefinition,
  getConfiguredScoreDeploymentBlock,
} from '@/src/lib/chain/multichain/registry';
import { ETHEREUM_SCORE_ABI } from './ethereum-score-contract';
import type { SelfMintOrderRow } from './order';

function attemptTimedOut(row: SelfMintOrderRow): boolean {
  const attemptedAt = row.send_attempted_at ? Date.parse(row.send_attempted_at) : 0;
  return attemptedAt > 0
    && Date.now() - attemptedAt > getChainDefinition(row.chain_id).receiptTimeoutMs;
}

async function knownReceipt(row: SelfMintOrderRow, hash: Hex | null) {
  if (!hash) return null;
  try {
    return await getChainPublicClient(row.chain_id).getTransactionReceipt({ hash });
  } catch (error) {
    const missing = error instanceof Error
      && error.name === 'TransactionReceiptNotFoundError';
    if (!missing) throw error;
    return null;
  }
}

async function findRedeemEvent(row: SelfMintOrderRow, receiptBlock?: bigint) {
  const client = getChainPublicClient(row.chain_id);
  const logs = await client.getContractEvents({
    address: getAddress(row.score_contract),
    abi: ETHEREUM_SCORE_ABI,
    eventName: 'ScoreRedeemed',
    args: { orderId: row.order_id },
    fromBlock: receiptBlock ?? getConfiguredScoreDeploymentBlock(row.chain_id),
    toBlock: receiptBlock ?? 'latest',
  });
  return logs.find((log) => (
    log.args.orderId?.toLowerCase() === row.order_id.toLowerCase()
    && log.args.tokenId === BigInt(row.token_id)
    && log.args.recipient && getAddress(log.args.recipient) === getAddress(row.recipient_address)
    && log.args.tokenURIHash?.toLowerCase() === row.uri_hash?.toLowerCase()
  )) ?? null;
}

export async function inspectSelfMintOrder(row: SelfMintOrderRow) {
  const client = getChainPublicClient(row.chain_id);
  const mapped = await client.readContract({
    address: getAddress(row.score_contract),
    abi: ETHEREUM_SCORE_ABI,
    functionName: 'tokenIdByOrderId',
    args: [row.order_id],
  });
  if (mapped !== 0n && mapped !== BigInt(row.token_id)) {
    throw new Error('orderId 映射到了错误 tokenId');
  }

  const hintedHash = row.replacement_tx_hash ?? row.tx_hash;
  const hintedReceipt = await knownReceipt(row, hintedHash);
  if (mapped === 0n) {
    if (hintedReceipt?.status === 'reverted') {
      return { state: 'reverted' as const, txHash: hintedReceipt.transactionHash };
    }
    if (attemptTimedOut(row)) return { state: 'uncertain' as const, reason: '发送窗口结束但链上没有 orderId 映射' };
    return { state: 'pending' as const };
  }
  if (!row.token_uri || !row.uri_hash) throw new Error('链上已完成但订单永久身份不完整');

  const [owner, tokenUri, redeemed] = await Promise.all([
    client.readContract({
      address: getAddress(row.score_contract), abi: ETHEREUM_SCORE_ABI,
      functionName: 'ownerOf', args: [mapped],
    }),
    client.readContract({
      address: getAddress(row.score_contract), abi: ETHEREUM_SCORE_ABI,
      functionName: 'tokenURI', args: [mapped],
    }),
    findRedeemEvent(row, hintedReceipt?.blockNumber),
  ]);
  if (getAddress(owner) !== getAddress(row.recipient_address) || tokenUri !== row.token_uri) {
    throw new Error('链上 owner 或 tokenURI 与冻结订单不一致');
  }
  if (!redeemed) throw new Error('orderId 映射存在，但 ScoreRedeemed 事件不匹配');

  const receipt = hintedReceipt?.transactionHash === redeemed.transactionHash
    ? hintedReceipt
    : await client.getTransactionReceipt({ hash: redeemed.transactionHash });
  if (receipt.status !== 'success') throw new Error('ScoreRedeemed 所在交易未成功');
  const currentBlock = await client.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1n;
  if (confirmations < BigInt(getRequiredConfirmations(row.chain_id))) {
    return {
      state: 'confirming' as const,
      txHash: redeemed.transactionHash,
      blockNumber: receipt.blockNumber,
    };
  }
  return {
    state: 'success' as const,
    txHash: redeemed.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}
