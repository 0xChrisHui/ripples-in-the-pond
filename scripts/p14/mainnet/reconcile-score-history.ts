import '../../_env';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, decodeEventLog, getAddress, http, zeroAddress } from 'viem';
import { optimism } from 'viem/chains';
import { SCORE_NFT_ABI } from '@/src/lib/chain/contracts';

const deployBlock = BigInt(process.argv[2] ?? '');
if (process.env.NEXT_PUBLIC_CHAIN_ID !== '10' || deployBlock <= 0n) {
  throw new Error('用法：reconcile-score-history.ts <ScoreNFT部署块>（仅 OP Mainnet）');
}
const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
const dbUrl = process.env.SERVER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!rpcUrl || !dbUrl || !dbKey) throw new Error('主网 RPC/Supabase 环境不完整');
const scoreContract = getAddress(process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS ?? '');
const publicClient = createPublicClient({ chain: optimism, transport: http(rpcUrl) });
const db = createClient(dbUrl, dbKey);

type ChainRow = {
  tx_hash: string; log_index: number; block_number: number;
  to_addr: string; token_id: number;
};

async function dbRows() {
  const [events, queues, mints, cursor] = await Promise.all([
    db.from('chain_events').select('tx_hash,log_index,block_number,to_addr,token_id')
      .ilike('contract', scoreContract).eq('event_name', 'Transfer').ilike('from_addr', zeroAddress),
    db.from('score_nft_queue').select('id,user_id,token_id,tx_hash,status').eq('status', 'success'),
    db.from('mint_events').select('score_queue_id,score_nft_token_id,tx_hash,user_id')
      .not('score_queue_id', 'is', null),
    db.from('system_kv').select('value').eq('key', 'last_synced_block').maybeSingle(),
  ]);
  for (const result of [events, queues, mints, cursor]) if (result.error) throw result.error;
  const userIds = [...new Set((queues.data ?? []).map((row) => row.user_id))];
  const users = userIds.length === 0
    ? { data: [], error: null }
    : await db.from('users').select('id,evm_address').in('id', userIds);
  if (users.error) throw users.error;
  return { events: events.data as ChainRow[], queues: queues.data ?? [],
    mints: mints.data ?? [], cursor: cursor.data?.value ?? null, users: users.data ?? [] };
}

async function receiptMint(txHash: `0x${string}`) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const event = receipt.logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({ abi: SCORE_NFT_ABI, data: log.data, topics: log.topics });
      return decoded.eventName === 'Transfer' && decoded.args.from === zeroAddress ? [decoded] : [];
    } catch { return []; }
  })[0];
  if (!event || event.eventName !== 'Transfer') throw new Error(`${txHash} 缺少 Score mint Transfer`);
  return { tokenId: Number(event.args.tokenId), origin: getAddress(event.args.to),
    blockNumber: Number(receipt.blockNumber), status: receipt.status };
}

async function main() {
  const rows = await dbRows();
  const head = await publicClient.getBlockNumber();
  const safeHead = head - 20n;
  const chain = await Promise.all(rows.events.map(async (row) => ({
    tokenId: row.token_id, origin: getAddress(row.to_addr), txHash: row.tx_hash,
    logIndex: row.log_index, blockNumber: row.block_number,
    receipt: await receiptMint(row.tx_hash as `0x${string}`),
  })));
  const queue = await Promise.all(rows.queues.map(async (row) => ({
    queueId: row.id, tokenId: row.token_id, txHash: row.tx_hash,
    origin: rows.users.find((user) => user.id === row.user_id)?.evm_address ?? null,
    receipt: await receiptMint(row.tx_hash as `0x${string}`),
  })));
  let latestTokenId = 0;
  for (let tokenId = 1; tokenId <= Math.max(2, chain.length + 2); tokenId++) {
    try {
      await publicClient.readContract({ address: scoreContract, abi: SCORE_NFT_ABI,
        functionName: 'ownerOf', args: [BigInt(tokenId)] });
      latestTokenId = tokenId;
    } catch { break; }
  }
  const eventIds = new Set(chain.map((row) => row.tokenId));
  const queueIds = new Set(queue.map((row) => row.tokenId));
  const mintIds = new Set(rows.mints.map((row) => row.score_nft_token_id));
  const chainOnly = chain.filter((row) => !queueIds.has(row.tokenId));
  const unresolved = chain.filter((row) => row.receipt.status !== 'success'
    || row.receipt.tokenId !== row.tokenId || row.receipt.origin !== row.origin);
  if (latestTokenId !== chain.length || eventIds.size !== chain.length || unresolved.length > 0) {
    throw new Error('链上供应量、chain_events 或 receipt 集合不一致');
  }
  console.log(JSON.stringify({
    chainId: 10, scoreContract, deployBlock: deployBlock.toString(), head: head.toString(),
    safeHead: safeHead.toString(), lastSyncedBlock: rows.cursor, latestTokenId,
    counts: { chainMints: chain.length, queueSuccess: queue.length, mintEvents: rows.mints.length },
    chainMints: chain, queueSuccess: queue,
    differences: {
      chainOnly: chainOnly.map((row) => ({ tokenId: row.tokenId, txHash: row.txHash,
        origin: row.origin, attribution: '链上 receipt 成功且 chain_events 已索引；旧生产 DB 无对应 queue 行' })),
      queueOnly: queue.filter((row) => !eventIds.has(row.tokenId)),
      mintEventOnly: rows.mints.filter((row) => !eventIds.has(row.score_nft_token_id)),
      chainMissingMintEvent: chain.filter((row) => !mintIds.has(row.tokenId)).map((row) => row.tokenId),
      unresolved,
    },
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
