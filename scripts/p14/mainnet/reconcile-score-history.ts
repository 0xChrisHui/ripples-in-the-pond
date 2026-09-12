import '../../_env';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, getAddress, http, zeroAddress } from 'viem';
import { optimism } from 'viem/chains';
import { SCORE_NFT_ABI } from '@/src/lib/chain/contracts';
import { scanScoreTransfers, type AuditTransfer } from './reconcile-chain-scan';

const CHAIN_ID = 10;
const DEPLOY_BLOCK = 155933187n;
const EXPECTED_SCORE = '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa';
const ZERO = zeroAddress.toLowerCase();
const APPLY_ACK = 'ACK_P14_G2_UPSERT_MISSING';
const INIT_ACK = 'ACK_P14_G2_INITIALIZE_CURSOR';

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hash(rows: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function eventKey(row: Pick<AuditTransfer, 'tx_hash' | 'log_index'>): string {
  return `${row.tx_hash.toLowerCase()}:${row.log_index}`;
}

function equalEvent(left: AuditTransfer, right: AuditTransfer): boolean {
  return left.chain_id === right.chain_id && left.contract === right.contract
    && left.event_name === right.event_name && left.block_number === right.block_number
    && left.from_addr === right.from_addr && left.to_addr === right.to_addr
    && left.token_id === right.token_id;
}

async function allRows(table: string, query: (from: number, to: number) => PromiseLike<{
  data: unknown[] | null; error: { message: string } | null;
}>): Promise<unknown[]> {
  const output: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await query(from, from + 999);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    output.push(...(result.data ?? []));
    if (!result.data || result.data.length < 1000) return output;
  }
}

async function main() {
  if (process.env.NEXT_PUBLIC_CHAIN_ID !== String(CHAIN_ID)) {
    throw new Error('只允许在 OP Mainnet 身份下运行 G2 对账');
  }
  const checkpointArg = arg('checkpoint');
  const requestBudget = Number(arg('max-requests'));
  if (!checkpointArg || !isAbsolute(checkpointArg)) {
    throw new Error('必须用 --checkpoint=<绝对路径> 指定可续跑 checkpoint');
  }
  if (!Number.isSafeInteger(requestBudget) || requestBudget <= 0) {
    throw new Error('必须用 --max-requests=<正整数> 设置 RPC 请求额度 ceiling');
  }
  const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const dbUrl = process.env.SERVER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rpcUrl || !dbUrl || !dbKey) throw new Error('主网 RPC/Supabase 环境不完整');
  const scoreContract = getAddress(process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS ?? '');
  if (scoreContract.toLowerCase() !== EXPECTED_SCORE) throw new Error('ScoreNFT 主网身份不匹配');

  const checkpointPath = resolve(checkpointArg);
  mkdirSync(dirname(checkpointPath), { recursive: true });
  const chain = createPublicClient({ chain: optimism, transport: http(rpcUrl) });
  const db = createClient(dbUrl, dbKey, { auth: { persistSession: false } });
  const latestHead = await chain.getBlockNumber();
  const checkpoint = await scanScoreTransfers({
    rpcUrl, contract: scoreContract, deployBlock: DEPLOY_BLOCK, latestHead, checkpointPath,
    requestBudget,
  });
  const chainRows = checkpoint.events.sort((a, b) => a.block_number - b.block_number
    || a.log_index - b.log_index);
  const dbRows = await allRows('chain_events', (from, to) => db.from('chain_events').select(
    'chain_id,contract,event_name,tx_hash,log_index,block_number,from_addr,to_addr,token_id,raw_data',
  ).eq('chain_id', CHAIN_ID).eq('contract', EXPECTED_SCORE)
    .order('block_number').order('log_index').range(from, to)) as AuditTransfer[];
  const chainMap = new Map(chainRows.map((row) => [eventKey(row), row]));
  const dbMap = new Map(dbRows.map((row) => [eventKey(row), row]));
  if (chainMap.size !== chainRows.length || dbMap.size !== dbRows.length) {
    throw new Error('链或 DB 集合存在重复 source log identity');
  }
  const missing = chainRows.filter((row) => !dbMap.has(eventKey(row)));
  let missingCount = missing.length;
  const extra = dbRows.filter((row) => !chainMap.has(eventKey(row)));
  const conflicts = chainRows.filter((row) => {
    const stored = dbMap.get(eventKey(row));
    return stored ? !equalEvent(row, stored) : false;
  });
  if (extra.length > 0 || conflicts.length > 0) {
    throw new Error(`DB 存在 extra=${extra.length} 或 conflict=${conflicts.length}，拒绝自动修复`);
  }
  if (missing.length > 0 && arg('apply-missing') === APPLY_ACK) {
    const { error } = await db.from('chain_events').upsert(missing, {
      onConflict: 'chain_id,contract,tx_hash,log_index', ignoreDuplicates: true,
    });
    if (error) throw new Error(`缺失事件幂等补写失败：${error.message}`);
    const verified = await db.from('chain_events').select('id', { count: 'exact', head: true })
      .eq('chain_id', CHAIN_ID).eq('contract', EXPECTED_SCORE);
    if (verified.error || verified.count !== chainRows.length) {
      throw new Error(`补写后集合数量仍不一致：${verified.error?.message ?? verified.count}`);
    }
    missingCount = 0;
  } else if (missing.length > 0) {
    throw new Error(`发现 ${missing.length} 条缺失；审阅后用 --apply-missing=${APPLY_ACK} 续跑`);
  }

  const [queues, mintRows, recipes] = await Promise.all([
    allRows('score_nft_queue', (from, to) => db.from('score_nft_queue')
      .select('id,token_id,tx_hash,status,user_id').eq('status', 'success').range(from, to)),
    allRows('mint_events', (from, to) => db.from('mint_events')
      .select('score_queue_id,score_nft_token_id,tx_hash,user_id')
      .not('score_queue_id', 'is', null).range(from, to)),
    allRows('wallet_recipe_queue', (from, to) => db.from('wallet_recipe_queue')
      .select('source_score_token_id,source_score_tx_hash,source_score_log_index,source_score_block')
      .eq('chain_id', CHAIN_ID).eq('source_score_contract', EXPECTED_SCORE).range(from, to)),
  ]);
  const mints = chainRows.filter((row) => row.from_addr === ZERO);
  const mintByToken = new Map(mints.map((row) => [row.token_id, row]));
  const integrity: string[] = [];
  for (const row of queues as { id: string; token_id: number; tx_hash: string }[]) {
    const mint = mintByToken.get(row.token_id);
    if (!mint || mint.tx_hash !== row.tx_hash.toLowerCase()) integrity.push(`score_queue:${row.id}`);
  }
  for (const row of mintRows as { score_queue_id: string; score_nft_token_id: number; tx_hash: string }[]) {
    const mint = mintByToken.get(row.score_nft_token_id);
    if (!mint || mint.tx_hash !== row.tx_hash.toLowerCase()) integrity.push(`mint_event:${row.score_queue_id}`);
  }
  for (const row of recipes as { source_score_token_id: number; source_score_tx_hash: string;
    source_score_log_index: number; source_score_block: number }[]) {
    const mint = mintByToken.get(row.source_score_token_id);
    if (!mint || mint.tx_hash !== row.source_score_tx_hash || mint.log_index !== row.source_score_log_index
      || mint.block_number !== row.source_score_block) integrity.push(`wallet_recipe:${row.source_score_token_id}`);
  }
  const currentOwners = new Map<number, string>();
  for (const row of chainRows) currentOwners.set(row.token_id, row.to_addr);
  for (const [tokenId, owner] of currentOwners) {
    if (owner === ZERO) continue;
    const [chainOwner, tokenUri] = await Promise.all([
      chain.readContract({ address: scoreContract, abi: SCORE_NFT_ABI,
        functionName: 'ownerOf', args: [BigInt(tokenId)] }),
      chain.readContract({ address: scoreContract, abi: SCORE_NFT_ABI,
        functionName: 'tokenURI', args: [BigInt(tokenId)] }),
    ]);
    if (chainOwner.toLowerCase() !== owner || tokenUri.length === 0) integrity.push(`onchain:${tokenId}`);
  }
  if (integrity.length > 0) throw new Error(`跨集合冲突：${integrity.join(',')}`);

  if (arg('initialize') === INIT_ACK) {
    const { data, error } = await db.rpc('initialize_source_chain_cursor', {
      p_chain_id: CHAIN_ID, p_score_contract: EXPECTED_SCORE, p_safe_head: checkpoint.safeHead,
    });
    if (error || String(data) !== checkpoint.safeHead) {
      throw new Error(`scoped cursor 初始化失败：${error?.message ?? String(data)}`);
    }
  }
  const report = {
    chainId: CHAIN_ID, contract: EXPECTED_SCORE, deployBlock: DEPLOY_BLOCK.toString(),
    safeHead: checkpoint.safeHead, latestHead: latestHead.toString(), requests: checkpoint.requests,
    retries: checkpoint.retries, counts: { chain: chainRows.length, mints: mints.length,
      db: dbRows.length, scoreQueue: queues.length, mintEvents: mintRows.length, recipes: recipes.length },
    differences: { missing: missingCount, extra: extra.length, conflicts: conflicts.length, integrity },
    collectionSha256: hash(chainRows), cursorInitialized: arg('initialize') === INIT_ACK,
  };
  const reportPath = resolve(arg('report') ?? `${checkpointPath}.report.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
