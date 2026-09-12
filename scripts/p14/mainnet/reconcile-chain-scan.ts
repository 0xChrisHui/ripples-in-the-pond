import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  decodeEventLog,
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from 'viem';
import { optimism } from 'viem/chains';

const transfer = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);
const CANDIDATE_RANGES = [100_000n, 50_000n, 10_000n, 2_000n];

function buildClient(rpcUrl: string) {
  return createPublicClient({ chain: optimism, transport: http(rpcUrl) });
}
type ScanClient = ReturnType<typeof buildClient>;

export type AuditTransfer = {
  chain_id: 10;
  contract: string;
  event_name: 'Transfer';
  tx_hash: string;
  log_index: number;
  block_number: number;
  from_addr: string;
  to_addr: string;
  token_id: number;
  raw_data: { from: string; to: string; tokenId: string; blockHash: string };
};

type Checkpoint = {
  version: 1;
  chainId: 10;
  contract: string;
  deployBlock: string;
  safeHead: string;
  chunkSize: string;
  nextBlock: string;
  requests: number;
  retries: number;
  events: AuditTransfer[];
};

function save(path: string, state: Checkpoint) {
  const temporary = join(dirname(path), `.p14-g2-${process.pid}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

async function withRetry<T>(
  operation: () => Promise<T>,
  state: Checkpoint,
  requestBudget: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (state.requests >= requestBudget) throw new Error('RPC 请求额度已用尽');
    state.requests += 1;
    try { return await operation(); } catch (error) {
      lastError = error;
      state.retries += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function probeRange(
  client: ScanClient,
  contract: Address,
  deployBlock: bigint,
  safeHead: bigint,
): Promise<{ chunkSize: bigint; requests: number }> {
  let requests = 0;
  for (const size of CANDIDATE_RANGES) {
    const fromBlock = safeHead - size + 1n > deployBlock ? safeHead - size + 1n : deployBlock;
    try {
      requests += 1;
      await client.getLogs({ address: contract, event: transfer, fromBlock, toBlock: safeHead });
      return { chunkSize: size, requests };
    } catch (error) {
      console.warn(`provider 拒绝 ${size} blocks 区间：`, error instanceof Error ? error.message : error);
    }
  }
  throw new Error('provider 连 2,000 blocks getLogs 区间也拒绝');
}

async function verifyLog(
  client: ScanClient,
  contract: Address,
  row: AuditTransfer,
): Promise<void> {
  const receipt = await client.getTransactionReceipt({ hash: row.tx_hash as Hex });
  const log = receipt.logs.find((item) => item.address.toLowerCase() === contract.toLowerCase()
    && item.logIndex === row.log_index);
  if (receipt.status !== 'success' || Number(receipt.blockNumber) !== row.block_number
    || receipt.blockHash.toLowerCase() !== row.raw_data.blockHash || !log) {
    throw new Error(`receipt 身份冲突：${row.tx_hash}/${row.log_index}`);
  }
  const decoded = decodeEventLog({ abi: [transfer], data: log.data, topics: log.topics });
  if (decoded.args.from.toLowerCase() !== row.from_addr
    || decoded.args.to.toLowerCase() !== row.to_addr
    || Number(decoded.args.tokenId) !== row.token_id) {
    throw new Error(`receipt 日志内容冲突：${row.tx_hash}/${row.log_index}`);
  }
}

export async function scanScoreTransfers(input: {
  rpcUrl: string;
  contract: Address;
  deployBlock: bigint;
  latestHead: bigint;
  checkpointPath: string;
  requestBudget: number;
}): Promise<Checkpoint> {
  const client = buildClient(input.rpcUrl);
  const safeHead = input.latestHead > 20n ? input.latestHead - 20n : 0n;
  let state: Checkpoint;
  if (existsSync(input.checkpointPath)) {
    state = JSON.parse(readFileSync(input.checkpointPath, 'utf8')) as Checkpoint;
    if (state.chainId !== 10 || state.contract !== input.contract.toLowerCase()
      || state.deployBlock !== input.deployBlock.toString()) {
      throw new Error('checkpoint 的 chain/contract/deployBlock 身份不匹配');
    }
    if (BigInt(state.safeHead) > safeHead || BigInt(state.chunkSize) <= 0n) {
      throw new Error('checkpoint safeHead 已超出当前 20-confirmation 链头或 chunk 无效');
    }
  } else {
    const probe = await probeRange(client, input.contract, input.deployBlock, safeHead);
    const chunkSize = probe.chunkSize;
    state = {
      version: 1,
      chainId: 10,
      contract: input.contract.toLowerCase(),
      deployBlock: input.deployBlock.toString(),
      safeHead: safeHead.toString(),
      chunkSize: chunkSize.toString(),
      nextBlock: input.deployBlock.toString(),
      requests: probe.requests,
      retries: 0,
      events: [],
    };
    save(input.checkpointPath, state);
  }
  const frozenHead = BigInt(state.safeHead);
  const chunk = BigInt(state.chunkSize);
  const totalBlocks = frozenHead - input.deployBlock + 1n;
  const estimatedRequests = (totalBlocks + chunk - 1n) / chunk;
  console.log(JSON.stringify({ totalBlocks: totalBlocks.toString(), chunkSize: state.chunkSize,
    estimatedRequests: estimatedRequests.toString(), requestBudget: input.requestBudget,
    worstCaseMinutes: Math.ceil(Number(estimatedRequests) * 8 / 60), safeHead: state.safeHead }));
  while (BigInt(state.nextBlock) <= frozenHead) {
    const fromBlock = BigInt(state.nextBlock);
    const toBlock = fromBlock + chunk - 1n < frozenHead ? fromBlock + chunk - 1n : frozenHead;
    const logs = await withRetry(() => client.getLogs({
      address: input.contract, event: transfer, fromBlock, toBlock,
    }), state, input.requestBudget);
    for (const log of logs) {
      const from = log.args.from;
      const to = log.args.to;
      const tokenId = log.args.tokenId;
      if (!from || !to || tokenId === undefined) throw new Error('Transfer 日志参数缺失');
      const row: AuditTransfer = {
        chain_id: 10, contract: state.contract, event_name: 'Transfer',
        tx_hash: log.transactionHash.toLowerCase(), log_index: log.logIndex,
        block_number: Number(log.blockNumber), from_addr: from.toLowerCase(),
        to_addr: to.toLowerCase(), token_id: Number(tokenId),
        raw_data: { from, to, tokenId: tokenId.toString(), blockHash: log.blockHash.toLowerCase() },
      };
      await withRetry(() => verifyLog(client, input.contract, row), state, input.requestBudget);
      state.events.push(row);
    }
    state.nextBlock = (toBlock + 1n).toString();
    save(input.checkpointPath, state);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return state;
}
