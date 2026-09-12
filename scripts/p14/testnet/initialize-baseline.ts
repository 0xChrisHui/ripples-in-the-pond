import '../../_env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, decodeEventLog, getAddress, http } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { SCORE_NFT_ABI, SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';

const APPLY = process.argv.includes('--apply');
const PROJECT_REF = 'ypjyurxoavjznwuvmglo';
const TEST_URL = `https://${PROJECT_REF}.supabase.co`;
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const publicClient = createPublicClient({
  chain: optimismSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

function hexNumber(value: string): number {
  return value === '0x' ? 0 : Number(BigInt(value));
}

function serviceKey(): string {
  const command = process.platform === 'win32' ? 'supabase.exe' : 'supabase';
  const result = spawnSync(command, ['projects', 'api-keys', '--project-ref', PROJECT_REF,
    '--reveal', '--output', 'json'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('无法读取测试 Supabase service key');
  const keys = JSON.parse(result.stdout) as { name: string; api_key: string }[];
  const key = keys.find((item) => item.name === 'service_role')?.api_key;
  if (!key) throw new Error('测试 Supabase service key 不存在');
  return key;
}

async function explorerLogs(contract: string, safeHead: bigint) {
  const apiKey = readFileSync(join(homedir(), '.config', 'ripples-in-the-pond', 'etherscan-api-key.txt'), 'utf8').trim();
  const creation = new URL('https://api.etherscan.io/v2/api');
  creation.search = new URLSearchParams({ chainid: '11155420', module: 'contract', action: 'getcontractcreation',
    contractaddresses: contract, apikey: apiKey }).toString();
  const created = await (await fetch(creation)).json() as { status: string; result: { blockNumber: string }[] };
  if (created.status !== '1') throw new Error('无法取得 ScoreNFT 部署块');
  const deployBlock = BigInt(created.result[0].blockNumber);
  const url = new URL('https://api.etherscan.io/v2/api');
  url.search = new URLSearchParams({ chainid: '11155420', module: 'logs', action: 'getLogs',
    fromBlock: deployBlock.toString(), toBlock: safeHead.toString(), address: contract,
    topic0: TRANSFER_TOPIC, topic1: ZERO_TOPIC, topic0_1_opr: 'and', page: '1', offset: '1000', apikey: apiKey }).toString();
  const response = await (await fetch(url)).json() as { status: string; message: string; result: Record<string, string | string[]>[] };
  if (response.status !== '1') throw new Error(`Score mint logs 查询失败：${response.message}`);
  return { deployBlock, logs: response.result };
}

async function main() {
  if (process.env.NEXT_PUBLIC_CHAIN_ID !== '11155420') throw new Error('只允许初始化 OP Sepolia 测试库');
  const contract = getAddress(SCORE_NFT_ADDRESS);
  const head = await publicClient.getBlockNumber();
  const safeHead = head - 20n;
  const history = await explorerLogs(contract, safeHead);
  const decoded = await Promise.all(history.logs.map(async (log) => {
    const hash = log.transactionHash as `0x${string}`;
    const receipt = await publicClient.getTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`历史 mint receipt 失败：${hash}`);
    const logIndex = hexNumber(log.logIndex as string);
    const found = receipt.logs.find((item) => item.logIndex === logIndex
      && item.address.toLowerCase() === contract.toLowerCase());
    if (!found) throw new Error(`历史 mint log 不在 receipt：${hash}/${logIndex}`);
    const event = decodeEventLog({ abi: SCORE_NFT_ABI, data: found.data, topics: found.topics });
    if (event.eventName !== 'Transfer' || event.args.from !== '0x0000000000000000000000000000000000000000') {
      throw new Error(`历史事件不是 mint Transfer：${hash}/${logIndex}`);
    }
    return { contract, event_name: 'Transfer', tx_hash: hash, log_index: logIndex,
      block_number: Number(receipt.blockNumber), from_addr: event.args.from, to_addr: event.args.to,
      token_id: Number(event.args.tokenId), raw_data: { from: event.args.from, to: event.args.to,
        tokenId: event.args.tokenId.toString() } };
  }));
  const tokenIds = decoded.map((row) => row.token_id).sort((a, b) => a - b);
  if (tokenIds.some((value, index) => value !== index + 1)) throw new Error('Score tokenId 历史不连续');
  const summary = { apply: APPLY, contract, deployBlock: history.deployBlock.toString(),
    head: head.toString(), safeHead: safeHead.toString(), mintCount: decoded.length };
  if (!APPLY) return console.log(JSON.stringify(summary, null, 2));
  const supabase = createClient(TEST_URL, serviceKey(), { auth: { persistSession: false } });
  const { count } = await supabase.from('wallet_recipe_queue').select('id', { count: 'exact', head: true });
  if ((count ?? 0) !== 0) throw new Error('P14 测试队列非空，拒绝重置基线');
  const { error: insertError } = await supabase.from('chain_events').upsert(decoded,
    { onConflict: 'tx_hash,log_index', ignoreDuplicates: true });
  if (insertError) throw insertError;
  const activationKey = `p14:activation:11155420:${contract.toLowerCase()}`;
  const cursorKey = `p14:cursor:11155420:${contract.toLowerCase()}`;
  const now = new Date().toISOString();
  const { error: kvError } = await supabase.from('system_kv').upsert([
    { key: 'last_synced_block', value: safeHead.toString(), updated_at: now },
    { key: activationKey, value: safeHead.toString(), updated_at: now },
    { key: cursorKey, value: `${history.deployBlock - 1n}:-1`, updated_at: now },
  ], { onConflict: 'key' });
  if (kvError) throw kvError;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
