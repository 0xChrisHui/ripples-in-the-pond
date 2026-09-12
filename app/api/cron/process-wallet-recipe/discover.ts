import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from 'viem';
import { CURRENT_CHAIN, CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { supabaseAdmin } from '@/src/lib/supabase';
import {
  compareDiscoveryCursor,
  formatDiscoveryCursor,
  parseDiscoveryCursor,
  type DiscoveryCursor,
} from '@/src/features/wallet-recipe/pipeline-policy';
import {
  deriveRecipeV1,
  hashRecipeV1,
  normalizeOriginWallet,
} from '@/src/lib/wallet-recipe/recipe-v1';
import { PipelineStepError } from './shared';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DISCOVERY_BATCH_SIZE = 100;
const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);
const readClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

type ChainEventRow = {
  contract: string;
  event_name: string;
  tx_hash: string;
  log_index: number;
  block_number: number;
  from_addr: string;
  to_addr: string;
  token_id: number;
};

export type DiscoveryResult = {
  discovered: number;
  scanned: number;
  cursor: string;
  safeHead: string;
};

function requireEvent(row: ChainEventRow, scoreContract: Address): {
  wallet: Address;
  txHash: Hex;
  cursor: DiscoveryCursor;
} {
  if (row.event_name !== 'Transfer' || row.contract.toLowerCase() !== scoreContract.toLowerCase()) {
    throw new PipelineStepError('chain_events 出现错误的 Score 合约或事件', 'permanent_input');
  }
  if (row.from_addr.toLowerCase() !== ZERO_ADDRESS) {
    throw new PipelineStepError('P14 发现器收到非 mint Transfer', 'permanent_input');
  }
  const wallet = normalizeOriginWallet(row.to_addr);
  if (!/^0x[0-9a-fA-F]{64}$/.test(row.tx_hash)) {
    throw new PipelineStepError('Score mint tx hash 格式无效', 'permanent_input');
  }
  if (!Number.isSafeInteger(row.token_id) || row.token_id <= 0
    || !Number.isSafeInteger(row.block_number) || row.block_number < 0
    || !Number.isSafeInteger(row.log_index) || row.log_index < 0) {
    throw new PipelineStepError('Score mint 日志序号或区块无效', 'permanent_input');
  }
  return {
    wallet,
    txHash: row.tx_hash.toLowerCase() as Hex,
    cursor: { blockNumber: BigInt(row.block_number), logIndex: row.log_index },
  };
}

async function readSystemValues(keys: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin.from('system_kv').select('key,value').in('key', keys);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.key as string, row.value as string]));
}

async function verifyEventSamples(rows: ChainEventRow[], scoreContract: Address): Promise<void> {
  if (rows.length === 0) return;
  const indexes = new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]);
  await Promise.all([...indexes].filter((index) => index >= 0).map(async (index) => {
    const row = rows[index];
    const receipt = await readClient.getTransactionReceipt({ hash: row.tx_hash as Hex });
    const log = receipt.logs.find((candidate) =>
      candidate.address.toLowerCase() === scoreContract.toLowerCase()
      && candidate.logIndex === row.log_index);
    if (receipt.status !== 'success' || Number(receipt.blockNumber) !== row.block_number || !log) {
      throw new PipelineStepError('chain_events 抽样 receipt 身份不一致', 'permanent_input');
    }
    const decoded = decodeEventLog({
      abi: [transferEvent],
      data: log.data,
      topics: log.topics,
    });
    const args = decoded.args;
    if (args.from.toLowerCase() !== row.from_addr.toLowerCase()
      || args.to.toLowerCase() !== row.to_addr.toLowerCase()
      || args.tokenId !== BigInt(row.token_id)) {
      throw new PipelineStepError('chain_events 抽样日志内容不一致', 'permanent_input');
    }
  }));
}

export async function discoverWalletRecipes(deadlineAt = Number.POSITIVE_INFINITY): Promise<DiscoveryResult> {
  let scoreContract: Address;
  try {
    scoreContract = getAddress(SCORE_NFT_ADDRESS);
  } catch {
    throw new PipelineStepError('ScoreNFT 合约地址未正确配置', 'permanent_input');
  }
  const contractKey = scoreContract.toLowerCase();
  const cursorKey = `p14:cursor:${CHAIN_ID_NUM}:${contractKey}`;
  const activationKey = `p14:activation:${CHAIN_ID_NUM}:${contractKey}`;
  const values = await readSystemValues(['last_synced_block', cursorKey, activationKey]);
  const sourceBlockText = values.get('last_synced_block');
  const cursorText = values.get(cursorKey);
  const activationText = values.get(activationKey);
  if (!sourceBlockText || !/^\d+$/.test(sourceBlockText)
    || !cursorText || !activationText || !/^\d+$/.test(activationText)) {
    throw new PipelineStepError('P14 activation/cursor 或上游链游标未初始化', 'permanent_input');
  }

  const head = await readClient.getBlockNumber();
  const safeHead = head > 20n ? head - 20n : 0n;
  if (BigInt(sourceBlockText) < safeHead) {
    throw new PipelineStepError('source_index_lagging', 'transient');
  }
  let cursor = parseDiscoveryCursor(cursorText);
  const cursorBlock = Number(cursor.blockNumber);
  const safeHeadNumber = Number(safeHead);
  if (!Number.isSafeInteger(cursorBlock) || !Number.isSafeInteger(safeHeadNumber)) {
    throw new PipelineStepError('链游标超出安全整数范围', 'permanent_input');
  }

  const { data, error } = await supabaseAdmin
    .from('chain_events')
    .select('contract,event_name,tx_hash,log_index,block_number,from_addr,to_addr,token_id')
    .ilike('contract', contractKey)
    .eq('event_name', 'Transfer')
    .eq('from_addr', ZERO_ADDRESS)
    .lte('block_number', safeHeadNumber)
    .or(`block_number.gt.${cursorBlock},and(block_number.eq.${cursorBlock},log_index.gt.${cursor.logIndex})`)
    .order('block_number', { ascending: true })
    .order('log_index', { ascending: true })
    .limit(DISCOVERY_BATCH_SIZE);
  if (error) throw error;
  await verifyEventSamples((data ?? []) as ChainEventRow[], scoreContract);

  let discovered = 0;
  for (const raw of (data ?? []) as ChainEventRow[]) {
    if (Date.now() >= deadlineAt) break;
    const event = requireEvent(raw, scoreContract);
    if (compareDiscoveryCursor(event.cursor, cursor) <= 0) {
      throw new PipelineStepError('chain_events 顺序未严格递增', 'permanent_input');
    }
    const recipe = deriveRecipeV1(event.wallet);
    const { data: sourceQueue, error: sourceError } = await supabaseAdmin
      .from('score_nft_queue').select('id').eq('tx_hash', event.txHash).limit(1).maybeSingle();
    if (sourceError) throw sourceError;
    const { data: registered, error: registerError } = await supabaseAdmin.rpc(
      'register_wallet_recipe_origin',
      {
        p_chain_id: CHAIN_ID_NUM,
        p_source_score_contract: contractKey,
        p_origin_wallet: event.wallet,
        p_source_score_queue_id: sourceQueue?.id ?? null,
        p_source_score_token_id: raw.token_id,
        p_source_score_tx_hash: event.txHash,
        p_source_score_log_index: raw.log_index,
        p_source_score_block: raw.block_number,
        p_recipe: recipe,
        p_recipe_hash: hashRecipeV1(recipe).slice(2),
        p_expected_cursor: formatDiscoveryCursor(cursor),
      },
    );
    if (registerError) throw registerError;
    if (!registered || registered.length !== 1) {
      throw new Error('register_wallet_recipe_origin 未返回持久化结果');
    }
    cursor = event.cursor;
    discovered += 1;
  }
  return {
    discovered,
    scanned: discovered,
    cursor: formatDiscoveryCursor(cursor),
    safeHead: safeHead.toString(),
  };
}
