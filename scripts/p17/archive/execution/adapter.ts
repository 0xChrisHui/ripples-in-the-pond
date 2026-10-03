import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, keccak256, parseAbi,
  stringToHex, type Address, type Hex, type Transaction } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getOriginalMintDeployment } from '../../../../src/lib/music-catalog/asset-registry';
import type { OriginalDeployment } from '../../../../src/lib/music-catalog/types';
import { MATERIAL_ABI, buildMaterialTypedData, hashMaterialAuthorization } from '../../../../src/lib/material-mint/contract';
import { inspectMaterialOrder } from '../../../../src/lib/material-mint/inspect';
import { verifyOpSbtReceipt } from '../../../../src/lib/material-mint/op/proof';
import type { MaterialOrder } from '../../../../src/lib/material-mint/types';
import { inspectArchiveItem } from '../inspect';
import type { ArchiveItem } from '../types';
import type { ExecutionAdapter, ExecutionAttempt, ExecutionChain, ExecutionConfig } from './types';
const OP_ABI = parseAbi(['function mint(address to,uint256 id,uint256 amount,bytes data)',
  'function isSoulbound() view returns(bool)', 'function paused() view returns(bool)']);
const ORACLE = parseAbi(['function getL1Fee(bytes) view returns(uint256)']);

export function requireExecutionTarget(item: ArchiveItem, target: OriginalDeployment | null, recipient: Address) {
  if (item.amount !== '1' || !item.operationId || !item.recipient || getAddress(item.recipient) !== recipient
    || !item.contractAddress || !item.tokenId || !item.metadataUri || !target || target.status !== 'ready'
    || !target.contractAddress || getAddress(target.contractAddress) !== getAddress(item.contractAddress)
    || target.tokenId !== item.tokenId || target.metadataUri !== item.metadataUri) throw Error('冻结留存目标不等于唯一已核验发行');
}
export function verifyExecutionTransaction(item: ArchiveItem, attempt: ExecutionAttempt,
  tx: Pick<Transaction, 'hash' | 'to' | 'from' | 'nonce' | 'input' | 'value' | 'chainId'>) {
  if (tx.hash !== attempt.hash || !tx.to || getAddress(tx.to) !== getAddress(item.contractAddress!)
    || getAddress(tx.from) !== getAddress(attempt.sender) || tx.nonce !== attempt.nonce
    || tx.value !== 0n || (tx.chainId !== undefined && tx.chainId !== item.chainId)
    || keccak256(tx.input) !== attempt.calldataHash) throw Error('留存回执对应交易身份不符');
}
function accountFromEnv(name: string) {
  const key = process.env[name];
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw Error('指定进程签名材料未就绪');
  return privateKeyToAccount(key as Hex);
}
export function createExecutionAdapter(config: ExecutionConfig, chain: ExecutionChain,
  assertLease: () => Promise<void>): ExecutionAdapter {
  const rpc = process.env[chain.rpcEnv];
  if (!rpc || !['http:', 'https:'].includes(new URL(rpc).protocol)) throw Error('明确RPC变量未配置');
  const client = createPublicClient({ transport: http(rpc, { retryCount: 0, timeout: 20000 }) });
  return {
    chainId: () => client.getChainId(),
    async validate(item) {
      requireExecutionTarget(item, getOriginalMintDeployment(item.trackId, item.chainId), config.recipient);
      const address = item.contractAddress!, id = BigInt(item.tokenId!);
      const code = await client.getCode({ address });
      if (!code || code === '0x') throw Error('冻结目标缺少实际字节码');
      if (await client.readContract({ address, abi: MATERIAL_ABI, functionName: 'uri', args: [id] }) !== item.metadataUri) throw Error('目标永久URI读回不符');
      if (chain.chainId === 10 && await client.readContract({ address, abi: OP_ABI, functionName: 'isSoulbound' }) !== true) throw Error('OP目标未证实为新SBT');
    },
    balance: sender => client.getBalance({ address: sender }),
    async nonce(sender) {
      const pending = await client.getTransactionCount({ address: sender, blockTag: 'pending' });
      if (pending !== await client.getTransactionCount({ address: sender, blockTag: 'latest' })) throw Error('钱包已有在途交易，禁止分配新nonce');
      return pending;
    },
    async inspect(item, attempt) {
      if (!attempt) return inspectArchiveItem(client, item, chain.confirmations);
      let tx, receipt;
      try {
        tx = await client.getTransaction({ hash: attempt.hash });
        verifyExecutionTransaction(item, attempt, tx);
        receipt = await client.getTransactionReceipt({ hash: attempt.hash });
      } catch (error) {
        if (error instanceof Error && ['TransactionNotFoundError','TransactionReceiptNotFoundError'].includes(error.name)) {
          return { ...item, state: 'unknown', archiveMint: { ...item.archiveMint, state: 'unknown' } };
        }
        throw error;
      }
      if (receipt.status === 'reverted') return { ...item, state: 'failed', archiveMint: { ...item.archiveMint, state: 'unknown' } };
      if (chain.chainId === 10) verifyOpSbtReceipt({ material_contract_address: item.contractAddress!,
        recipient_address: item.recipient!, token_id: Number(item.tokenId) }, receipt, tx);
      else {
        if (!attempt.authorization) throw Error('ETH原曲尝试缺少冻结凭证');
        const { digest, deadline, authorizer } = attempt.authorization;
        const row: MaterialOrder = { order_id: item.operationId!, user_id: 'p17-archive', request_key: item.operationId!,
          track_id: item.trackId, chain_id: 1, contract_address: item.contractAddress!, token_id: item.tokenId!,
          recipient_address: item.recipient!, amount: 1, catalog_revision: '', metadata_uri: item.metadataUri!,
          uri_hash: keccak256(stringToHex(item.metadataUri!)), status: 'submitted', version: 0, current_digest: digest,
          tx_hash: attempt.hash, confirmed_block: null, confirmed_block_hash: null, confirmed_log_index: null,
          lease_owner: null, lease_until: null, error_kind: null };
        const result = await inspectMaterialOrder(client, row, [{ order_id: row.order_id, digest, deadline, authorizer,
          send_attempted_at: attempt.attemptedAt, outcome: 'submitted', tx_hashes: [attempt.hash] }],
        { fromBlock: receipt.blockNumber, requiredConfirmations: chain.confirmations });
        if (result.state !== 'success') return { ...item, state: 'confirming', archiveMint: { ...item.archiveMint, state: 'pending' } };
      }
      return inspectArchiveItem(client, item, chain.confirmations);
    },
    async sign(item, expected, nonce) {
      const sender = accountFromEnv(chain.chainId === 1 ? config.recipientKeyEnv ?? 'P17_ARCHIVE_RECIPIENT_PRIVATE_KEY'
        : config.opSenderKeyEnv ?? 'OPERATOR_PRIVATE_KEY');
      if (sender.address !== expected.sender) throw Error('进程发送密钥与冻结sender不符');
      let data: Hex, authorization: ExecutionAttempt['authorization'];
      if (chain.chainId === 1) {
        if (sender.address !== config.recipient) throw Error('ETH须接收钱包自己支付Gas');
        const authorizer = accountFromEnv(config.authorizerKeyEnv ?? 'ETH_SCORE_AUTHORIZER_PRIVATE_KEY');
        const a = { orderId: item.operationId!, tokenId: BigInt(item.tokenId!), amount: 1n, recipient: config.recipient,
          tokenURIHash: keccak256(stringToHex(item.metadataUri!)), deadline: BigInt(Math.floor(Date.now() / 1000) + 900) };
        if (await client.readContract({ address: item.contractAddress!, abi: MATERIAL_ABI, functionName: 'hasClaimed',
          args: [config.recipient, a.tokenId] })) throw Error('ETH历史领取资格已消费，禁止重发');
        const signature = await authorizer.signTypedData(buildMaterialTypedData(1, item.contractAddress!, a));
        authorization = { digest: hashMaterialAuthorization(1, item.contractAddress!, a), deadline: Number(a.deadline), authorizer: authorizer.address };
        data = encodeFunctionData({ abi: MATERIAL_ABI, functionName: 'redeem', args: [a, authorizer.address, signature] });
      } else data = encodeFunctionData({ abi: OP_ABI, functionName: 'mint', args: [config.recipient, BigInt(item.tokenId!), 1n, '0x'] });
      const role = keccak256(stringToHex(chain.chainId === 1 ? 'AUTHORIZER_ROLE' : 'MINTER_ROLE'));
      if (await client.readContract({ address: item.contractAddress!, abi: MATERIAL_ABI, functionName: 'hasRole',
        args: [role, authorization?.authorizer ?? sender.address] }) !== true) throw Error('冻结发送/授权账户未持有发行角色');
      const estimate = await client.estimateGas({ account: sender, to: item.contractAddress!, data, value: 0n });
      if (estimate > BigInt(expected.gasLimit)) throw Error('实际留存Gas超过冻结上限');
      const raw = await sender.signTransaction({ chainId: chain.chainId, nonce, to: item.contractAddress!, data, value: 0n,
        gas: BigInt(expected.gasLimit), maxFeePerGas: BigInt(expected.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(expected.maxPriorityFeePerGas), type: 'eip1559' });
      if (chain.chainId === 10 && await client.readContract({ address: '0x420000000000000000000000000000000000000F',
        abi: ORACLE, functionName: 'getL1Fee', args: [raw] }) > BigInt(expected.l1FeeCapWei)) throw Error('OP实际L1费用超过冻结预算');
      return { raw, hash: keccak256(raw), calldataHash: keccak256(data), ...(authorization ? { authorization } : {}) };
    },
    send: raw => createWalletClient({ transport: http(rpc, { retryCount: 0, timeout: 20000 }) }).sendRawTransaction({ serializedTransaction: raw }),
    assertLease,
  };
}
