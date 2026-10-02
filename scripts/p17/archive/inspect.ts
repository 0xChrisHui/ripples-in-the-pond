import { createPublicClient, http, type PublicClient, type Hex } from 'viem';
import { MATERIAL_ABI } from '../../../src/lib/material-mint/contract';
import type { ArchiveItem } from './types';
import { verifyArchiveReceipt } from './proof';

/** 只读函数：没有send/write能力；未知hash保持未知，已有账本不生成第二项。 */
export async function inspectArchiveItem(client: PublicClient, item: ArchiveItem, requiredConfirmations = 12): Promise<ArchiveItem> {
  const checkedAt = new Date().toISOString();
  if (!item.recipient || !item.contractAddress || !item.tokenId || !item.metadataUri) {
    return { ...item, inspection: { status: 'awaiting_input', reason: '接收地址或真实部署尚缺输入', checkedAt } };
  }
  if (await client.getChainId() !== item.chainId) throw new Error('留存RPC网络不符');
  const hashes = [...new Set([...(item.txHashes ?? []), item.archiveMint.txHash].filter((hash): hash is Hex => hash !== null))];
  if (!hashes.length) return { ...item, inspection: { status: 'unknown', reason: '缺少已知mint哈希，保持原状态且禁止补发；需人工补原交易线索', checkedAt } };
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const observedHead = await client.getBlock({ blockNumber: head });
  if (!observedHead.hash) throw new Error('观测区块尚无固定hash');
  const [balance, uri] = await Promise.all([
    client.readContract({ address: item.contractAddress, abi: MATERIAL_ABI, functionName: 'balanceOf',
      args: [item.recipient, BigInt(item.tokenId)], blockNumber: head }),
    client.readContract({ address: item.contractAddress, abi: MATERIAL_ABI, functionName: 'uri', args: [BigInt(item.tokenId)], blockNumber: head }),
  ]);
  let next = { ...item, inspection: { status: 'unknown', reason: '尚未取得完整mint证明，禁止补发', checkedAt } };
  // 只检查最近16个已知哈希；其余历史仍留在原账本，下一轮可按原交易线索核对。
  for (const hash of hashes.slice(-16)) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      const checked = verifyArchiveReceipt(item, receipt, { chainId: item.chainId, head, balance, uri,
        canonicalHash: block.hash!, requiredConfirmations, checkedAt });
      next = { ...next, inspection: checked };
      if (checked.status === 'confirmed' && 'mintProof' in checked) {
        const currentHead = await client.getBlock({ blockNumber: head });
        if (currentHead.hash !== observedHead.hash) return { ...next, state: 'confirming',
          archiveMint: { ...item.archiveMint, state: 'pending' },
          inspection: { status: 'confirming', reason: '观测余额的head已重组，需重新只读核验', checkedAt } };
        const proof = checked.mintProof!;
        return { ...next, state: 'confirmed', archiveMint: { state: 'confirmed', recipient: item.recipient,
          amount: item.amount, txHash: proof.txHash, blockNumber: proof.blockNumber, blockHash: proof.blockHash,
          logIndex: proof.logIndex, verifiedAt: checkedAt, proof: JSON.stringify({ ...proof, observedBlockHash: observedHead.hash }) } };
      }
      next.state = checked.status === 'confirming' ? 'confirming' : 'unknown';
      next.archiveMint = { ...item.archiveMint, state: checked.status === 'confirming' ? 'pending' : 'unknown' };
    } catch (error) {
      if (!(error instanceof Error) || !['TransactionNotFoundError','TransactionReceiptNotFoundError'].includes(error.name)) throw error;
      next.state = 'unknown'; next.archiveMint = { ...item.archiveMint, state: 'unknown' };
    }
  }
  return next;
}

// 工具构造只读client，不读取运营密钥，不猜RPC或接收钱包；调用者明确提供链与endpoint。
export function createArchiveReader(chainId: 1 | 10, rpcUrl: string) {
  const parsed = new URL(rpcUrl);
  if (!['http:','https:'].includes(parsed.protocol)) throw new Error('RPC协议无效');
  const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 10000 }) });
  return { chainId, inspect: (item: ArchiveItem) => {
    if (item.chainId !== chainId) throw new Error('核验项与显式链不符');
    return inspectArchiveItem(client, item);
  } };
}
