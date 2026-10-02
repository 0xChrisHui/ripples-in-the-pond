import { decodeFunctionData, decodeEventLog, getAddress, parseAbi, zeroAddress, type Transaction, type TransactionReceipt } from 'viem';
import { MATERIAL_ABI, hashMaterialAuthorization } from './contract';
import type { MaterialOrder, MaterialAttempt, MaterialMintProof } from './types';
const TRANSFER_ABI = parseAbi(['event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)']);

export function verifyMaterialTransaction(row: MaterialOrder, attempts: readonly MaterialAttempt[], tx: Transaction) {
  if (!tx.to || getAddress(tx.to) !== getAddress(row.contract_address) || getAddress(tx.from) !== getAddress(row.recipient_address)
    || tx.value !== 0n || (tx.chainId !== undefined && tx.chainId !== row.chain_id)) throw new Error('原曲交易坐标/付款账户不符');
  const decoded = decodeFunctionData({ abi: MATERIAL_ABI, data: tx.input });
  if (decoded.functionName !== 'redeem') throw new Error('不是固定 redeem 调用');
  const [a, authorizer] = decoded.args;
  const digest = hashMaterialAuthorization(row.chain_id, row.contract_address, a);
  const attempt = attempts.find((item) => item.digest === digest && item.deadline === Number(a.deadline)
    && getAddress(item.authorizer) === getAddress(authorizer));
  if (!attempt || a.orderId !== row.order_id || String(a.tokenId) !== String(row.token_id) || a.amount !== 1n
    || getAddress(a.recipient) !== getAddress(row.recipient_address) || a.tokenURIHash !== row.uri_hash) throw new Error('交易不对应冻结订单/历史已签尝试');
  return attempt;
}
export function materialReceiptProof(row: MaterialOrder, attempt: MaterialAttempt, receipt: TransactionReceipt): MaterialMintProof {
  if (receipt.status !== 'success') throw new Error('没有成功回执');
  let redeemedIndex: number | null = null, minted = false;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(row.contract_address)) continue;
    let decoded: ReturnType<typeof decodeEventLog> | null = null;
    try { decoded = decodeEventLog({ abi: [...MATERIAL_ABI, ...TRANSFER_ABI], data: log.data, topics: log.topics }); }
    catch { continue; /* 仅忽略非目标事件，身份校验在解码后执行。 */ }
    const args = decoded.args as Record<string, unknown>;
    if (decoded.eventName === 'MaterialRedeemed' && args.orderId === row.order_id
      && String(args.tokenId) === String(row.token_id) && args.amount === 1n
      && getAddress(String(args.recipient)) === getAddress(row.recipient_address) && args.tokenURIHash === row.uri_hash) redeemedIndex = log.logIndex;
    if (decoded.eventName === 'TransferSingle' && args.from === zeroAddress
      && getAddress(String(args.to)) === getAddress(row.recipient_address)
      && String(args.id) === String(row.token_id) && args.value === 1n) minted = true;
  }
  if (redeemedIndex === null || !minted) throw new Error('缺少对应原曲兑换及 mint 双事件');
  return { orderId: row.order_id, chainId: row.chain_id, contract: row.contract_address.toLowerCase(),
    recipient: row.recipient_address.toLowerCase(), tokenId: String(row.token_id), amount: '1', uriHash: row.uri_hash,
    txHash: receipt.transactionHash, blockNumber: String(receipt.blockNumber), blockHash: receipt.blockHash,
    logIndex: redeemedIndex, digest: attempt.digest, canonicalConfirmed: true };
}
