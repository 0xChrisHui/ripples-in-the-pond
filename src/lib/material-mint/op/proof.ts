import { decodeEventLog, decodeFunctionData, getAddress, parseAbi, zeroAddress, type Address, type Hex, type TransactionReceipt } from 'viem';

const ABI = parseAbi(['function mint(address to,uint256 id,uint256 amount,bytes data)',
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)']);
/** 新SBT只凭冻结目标+calldata+真实mint事件确认；旧队列保留原确认行为。 */
export function verifyOpSbtReceipt(job: { material_contract_address: string; recipient_address: string; token_id: number },
  receipt: TransactionReceipt, transaction: { hash: Hex; to: Address | null; from: Address; input: Hex; value: bigint }) {
  const target = getAddress(job.material_contract_address), recipient = getAddress(job.recipient_address);
  if (receipt.status !== 'success' || receipt.transactionHash !== transaction.hash || !transaction.to || getAddress(transaction.to) !== target
    || transaction.value !== 0n) throw new Error('SBT_RECEIPT_COORDINATE_MISMATCH');
  const decoded = decodeFunctionData({ abi: ABI, data: transaction.input });
  if (decoded.functionName !== 'mint' || getAddress(decoded.args[0]) !== recipient
    || decoded.args[1] !== BigInt(job.token_id) || decoded.args[2] !== 1n || decoded.args[3] !== '0x') throw new Error('SBT_CALLDATA_MISMATCH');
  const minted = receipt.logs.some(log => {
    if (getAddress(log.address) !== target) return false;
    try {
      const event = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics, strict: true });
      return event.eventName === 'TransferSingle' && event.args.from === zeroAddress
        && getAddress(event.args.operator) === getAddress(transaction.from) && getAddress(event.args.to) === recipient
        && event.args.id === BigInt(job.token_id) && event.args.value === 1n;
    } catch { return false; /* 其他日志不能充当目标mint证明。 */ }
  });
  if (!minted) throw new Error('SBT_MINT_EVENT_MISSING');
}
