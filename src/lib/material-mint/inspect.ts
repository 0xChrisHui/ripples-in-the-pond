import { type PublicClient, type Hex } from 'viem';
import { MATERIAL_ABI } from './contract';
import { verifyMaterialTransaction, materialReceiptProof } from './receipt-check';
import type { MaterialOrder, MaterialAttempt } from './types';
export async function inspectMaterialOrder(client: PublicClient, row: MaterialOrder, attempts: readonly MaterialAttempt[],
  options: { fromBlock: bigint; requiredConfirmations: number; maxPages?: number }) {
  if (await client.getChainId() !== row.chain_id) throw new Error('原曲 RPC 网络不符');
  const mapped = await client.readContract({ address: row.contract_address, abi: MATERIAL_ABI,
    functionName: 'redeemedOrders', args: [row.order_id] });
  const head = await client.getBlockNumber({cacheTime:0});
  if (!mapped && row.status === 'success') return { state:'confirming' as const, nextCursor:String(options.fromBlock), reason:'已确认订单映射消失，回退重新核验重组' };
  const hashes = [...new Set([row.tx_hash, ...attempts.flatMap((attempt) => attempt.tx_hashes)].filter((hash): hash is Hex => hash !== null))];
  // unknown 缺hash时只查有界日志，保存nextCursor，下次继续，不因查不到重发。
  let cursor = options.fromBlock;
  if (mapped && (!hashes.length || row.status === 'unknown')) {
    for (let page = 0; page < (options.maxPages ?? 10) && cursor <= head; page++) {
      const end = cursor + 1999n < head ? cursor + 1999n : head;
      const logs = await client.getContractEvents({ address: row.contract_address, abi: MATERIAL_ABI,
        eventName: 'MaterialRedeemed', args: { orderId: row.order_id }, fromBlock: cursor, toBlock: end });
      hashes.push(...logs.map((log) => log.transactionHash)); cursor = end + 1n;
      if (hashes.length) break;
    }
  }
  let missing = false;
  for (const hash of hashes) {
    try {
      const transaction = await client.getTransaction({ hash });
      const attempt = verifyMaterialTransaction(row, attempts, transaction);
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt.status === 'reverted') { missing = true; continue; }
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (block.hash !== receipt.blockHash || head - receipt.blockNumber + 1n < BigInt(options.requiredConfirmations)) {
        return { state: 'confirming' as const, nextCursor: String(options.fromBlock), reason: '等待确认或重新核验重组' };
      }
      if (!mapped) throw new Error('成功事件与订单映射不一致');
      const uri = await client.readContract({ address: row.contract_address, abi: MATERIAL_ABI, functionName: 'uri', args: [BigInt(row.token_id)] });
      if (uri !== row.metadata_uri) throw new Error('链上永久 URI 与冻结订单不同');
      // 转出不推翻过去发生的 mint；当前余额由展示/留存检查另行读取。
      return { state: 'success' as const, proof: materialReceiptProof(row, attempt, receipt), nextCursor: String(cursor) };
    } catch (error) {
      if (error instanceof Error && ['TransactionNotFoundError', 'TransactionReceiptNotFoundError'].includes(error.name)) { missing = true; continue; }
      throw error;
    }
  }
  if (mapped && hashes.length && missing) {
    // replacement 可导致旧hash消失；下次从部署/游标起查order事件，不释放互斥。
    return { state: 'unknown' as const, nextCursor: String(options.fromBlock), reason: '已有兑换映射，需按订单日志恢复替换交易' };
  }
  return { state: mapped ? 'unknown' as const : 'pending' as const, nextCursor: String(cursor), reason: '未取得完整成功证据，禁止自动补发' };
}
