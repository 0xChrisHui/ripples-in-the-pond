import { decodeEventLog, getAddress, parseAbi, zeroAddress, type Hex } from 'viem';
import type { ArchiveItem } from './types';

const EVENTS = parseAbi([
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
  'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)',
]);
export type ArchiveReceipt = {
  status: 'success' | 'reverted'; transactionHash: Hex; blockNumber: bigint; blockHash: Hex;
  logs: readonly { address: string; topics: readonly [Hex, ...Hex[]] | []; data: Hex; logIndex: number | null }[];
};
export type ArchiveObservation = {
  chainId: number; head: bigint; canonicalHash: Hex; balance: bigint; uri: string;
  requiredConfirmations: number; checkedAt: string;
};

/** 留存同时需要原mint和当前余额；转入、旧数据库success或孤块回执均不算通过。 */
export function verifyArchiveReceipt(item: ArchiveItem, receipt: ArchiveReceipt, observation: ArchiveObservation) {
  if (item.amount !== '1') throw new Error('留存目标数量必须为1');
  const result = (status: 'awaiting_input' | 'needs_proof' | 'confirming' | 'confirmed', reason: string) => ({
    status, reason, checkedAt: observation.checkedAt, balance: String(observation.balance),
  });
  if (!item.recipient || !item.contractAddress || !item.tokenId || !item.metadataUri) {
    return result('awaiting_input', '缺少明确接收地址或真实部署坐标');
  }
  if (observation.chainId !== item.chainId) throw new Error('留存核验RPC网络不符');
  if (!Number.isSafeInteger(observation.requiredConfirmations) || observation.requiredConfirmations < 1) {
    throw new Error('确认数必须为正整数');
  }
  if (observation.uri !== item.metadataUri) throw new Error('链上URI与冻结留存计划不同');
  if (receipt.status !== 'success') return result('needs_proof', '回执未成功，禁止自动补发');
  if (receipt.blockHash !== observation.canonicalHash
    || observation.head - receipt.blockNumber + 1n < BigInt(observation.requiredConfirmations)) {
    return result('confirming', '等待确认或重新核验重组');
  }
  let logIndex: number | null = null, mintedAmount = 0n;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(item.contractAddress) || log.logIndex === null) continue;
    try {
      const event = decodeEventLog({ abi: EVENTS, data: log.data, topics: [...log.topics] as [Hex, ...Hex[]] | [], strict: true });
      const args = event.args;
      if (args.from !== zeroAddress || getAddress(args.to) !== getAddress(item.recipient)) continue;
      if (event.eventName === 'TransferSingle' && String(event.args.id) === item.tokenId) {
        mintedAmount += event.args.value; logIndex ??= log.logIndex;
      }
      if (event.eventName === 'TransferBatch' && event.args.ids.length === event.args.values.length) {
        for (let index = 0; index < event.args.ids.length; index++) {
          if (String(event.args.ids[index]) === item.tokenId) {
            mintedAmount += event.args.values[index]; logIndex ??= log.logIndex;
          }
        }
      }
    } catch { continue; /* 其他合约事件或不可解码日志不构成mint证明。 */ }
  }
  if (logIndex === null || mintedAmount < BigInt(item.amount)) return result('needs_proof', '缺少指定接收地址的原mint事件');
  if (observation.balance < BigInt(item.amount)) return result('needs_proof', '原mint可追溯，但当前余额不足目标');
  return { ...result('confirmed', '原mint事件、规范区块、URI与当前余额一致'), mintProof: {
    chainId: item.chainId, contract: item.contractAddress, tokenId: item.tokenId, recipient: item.recipient,
    amount: item.amount, mintedAmount: String(mintedAmount), txHash: receipt.transactionHash,
    blockNumber: String(receipt.blockNumber), blockHash: receipt.blockHash, logIndex,
    observedBalance: String(observation.balance), observedAtBlock: String(observation.head),
  } };
}
