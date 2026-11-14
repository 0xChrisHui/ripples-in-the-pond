import { decodeFunctionData, keccak256, stringToHex, type Address, type Hex } from 'viem';
import { publicClient } from '@/src/lib/chain/public-client';
import { SCORE_NFT_ABI, SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import type { ScoreMintQueueRow, ScoreMintStatus } from '@/src/types/score-mint';
import { ATOMIC_ABI, issueArgs, orderId, tokenUri, saveAtomic } from './shared';

/** 不依赖当前 owner：用户可能在恢复订单之前已经转赠 NFT。 */
export async function confirmAtomic(row: ScoreMintQueueRow, owner: string): Promise<ScoreMintStatus> {
  const hash = row.tx_hash as Hex;
  let receipt;
  try { receipt = await publicClient.getTransactionReceipt({ hash }); }
  catch {
    if (!row.mint_attempted_at || Date.now() - Date.parse(row.mint_attempted_at) > 900_000) {
      throw Error('CRITICAL: 原子交易超过十五分钟无回执，禁止重复发送');
    }
    return 'minting_onchain';
  }
  if (receipt.status !== 'success') throw Error('CRITICAL: 原子交易回滚，保留编号与资料等待人工对账');
  const tx = await publicClient.getTransaction({ hash });
  const expected = issueArgs(row);
  const decoded = decodeFunctionData({ abi: ATOMIC_ABI, data: tx.input });
  if (tx.to?.toLowerCase() !== row.atomic_issuer?.toLowerCase()
    || decoded.functionName !== 'mintScoreWithURI'
    || JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v).toLowerCase()
      !== JSON.stringify(expected, (_, v) => typeof v === 'bigint' ? v.toString() : v).toLowerCase()) {
    throw Error('CRITICAL: 原子交易目标或固定参数不一致');
  }
  const [mapped, uri] = await Promise.all([
    publicClient.readContract({ address: row.atomic_issuer as Address, abi: ATOMIC_ABI,
      functionName: 'tokenIdByOrderId', args: [orderId(row)], blockNumber: receipt.blockNumber }),
    publicClient.readContract({ address: SCORE_NFT_ADDRESS, abi: SCORE_NFT_ABI,
      functionName: 'tokenURI', args: [BigInt(row.expected_token_id!)], blockNumber: receipt.blockNumber }),
  ]);
  const event = receipt.logs.find(log => log.address.toLowerCase() === row.atomic_issuer!.toLowerCase()
    && log.topics[0] === keccak256(stringToHex('ScoreIssued(bytes32,address,uint256,bytes32)'))
    && log.topics[1] === orderId(row));
  if (mapped !== BigInt(row.expected_token_id!) || uri !== tokenUri(row) || !event
    || event.topics[2]?.slice(-40).toLowerCase() !== row.atomic_recipient!.slice(2).toLowerCase()
    || BigInt(event.topics[3] ?? '0') !== mapped || event.data !== keccak256(stringToHex(uri))) {
    throw Error('CRITICAL: 原子发行事件、旧订单映射或永久 URI 不一致');
  }
  await saveAtomic(row, owner, { token_id: Number(mapped), token_uri: uri,
    uri_tx_hash: hash, uri_attempted_at: row.mint_attempted_at });
  return 'setting_uri';
}
