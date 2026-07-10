import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/chain/operator-wallet';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';

/**
 * GET /api/cron/sync-chain-events?secret=xxx
 *
 * Phase 3B — 链上 Transfer 事件同步。从 system_kv.last_synced_block 开始拉 ScoreNFT
 * Transfer 事件写 chain_events，UNIQUE(tx_hash, log_index) 防重复。
 *
 * Alchemy Free 限 10 区块/请求 → 循环分批；单次 cron 最多 MAX_ITERATIONS 批防超时。
 *
 * P10-B P3-7：① Upstash 锁防重叠运行（重叠会白拉 RPC + cursor 抖动；未配 Upstash 则跳过，
 * 只读同步 fail-open 可接受）② 逐 batch 批量 upsert 替代逐条 upsert。
 */

const CHUNK_SIZE = 10n;
const MAX_ITERATIONS = 50;
const LOCK_KEY = 'cron:sync-chain-events:lock';
const LOCK_TTL_S = 120;

const transferEvent = SCORE_NFT_ABI.find(
  (a) => a.type === 'event' && a.name === 'Transfer',
)!;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']+|["']+$/g, '').trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']+|["']+$/g, '').trim();
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

type ChainEventRow = {
  contract: string;
  event_name: string;
  tx_hash: string;
  log_index: number;
  block_number: number;
  from_addr: string;
  to_addr: string;
  token_id: number;
  raw_data: { from: string; to: string; tokenId: string };
};

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  // P3-7 锁：SET NX + TTL 防重叠；拿不到锁说明另一实例在跑，直接退。
  const redis = getRedis();
  if (redis) {
    const ok = await redis.set(LOCK_KEY, '1', { nx: true, ex: LOCK_TTL_S });
    if (ok !== 'OK') return NextResponse.json({ result: 'busy' });
  }

  try {
    const { data: kv } = await supabaseAdmin
      .from('system_kv')
      .select('value')
      .eq('key', 'last_synced_block')
      .single();

    let cursor = BigInt(kv?.value ?? '0');
    const latestBlock = await publicClient.getBlockNumber();

    if (cursor >= latestBlock) {
      return NextResponse.json({ synced: 0, cursor: String(cursor) });
    }

    let totalInserted = 0;
    let totalLogs = 0;
    let iterations = 0;

    // Phase 6 A3：batch 失败不推进 cursor 越过它；已成功的前面 batch 持久化保留，
    //   失败 batch 下次 cron 全量重做（onConflict ignoreDuplicates 保证幂等）。
    while (cursor < latestBlock && iterations < MAX_ITERATIONS) {
      const from = cursor + 1n;
      const to = from + CHUNK_SIZE - 1n < latestBlock ? from + CHUNK_SIZE - 1n : latestBlock;

      const logs = await publicClient.getLogs({
        address: SCORE_NFT_ADDRESS,
        event: transferEvent,
        fromBlock: from,
        toBlock: to,
      });
      totalLogs += logs.length;

      if (logs.length > 0) {
        // P3-7：整个 batch 一次 upsert（替代逐条），减少往返
        const rows: ChainEventRow[] = logs.map((log) => ({
          contract: SCORE_NFT_ADDRESS,
          event_name: 'Transfer',
          tx_hash: log.transactionHash,
          log_index: log.logIndex,
          block_number: Number(log.blockNumber),
          from_addr: log.args.from as string,
          to_addr: log.args.to as string,
          token_id: Number(log.args.tokenId),
          raw_data: {
            from: log.args.from as string,
            to: log.args.to as string,
            tokenId: String(log.args.tokenId),
          },
        }));

        const { error } = await supabaseAdmin
          .from('chain_events')
          .upsert(rows, { onConflict: 'tx_hash,log_index', ignoreDuplicates: true });

        if (error) {
          console.error(`[sync] batch upsert failed at blocks ${from}-${to}:`, error);
          await persistCursor(cursor);
          return NextResponse.json(
            { result: 'partial', synced: totalInserted, cursor: String(cursor), error: error.message },
            { status: 200 },
          );
        }
        totalInserted += rows.length;
      }

      cursor = to;
      iterations++;
    }

    await persistCursor(cursor);

    return NextResponse.json({
      synced: totalInserted,
      totalLogs,
      iterations,
      cursor: String(cursor),
      latestBlock: String(latestBlock),
      caughtUp: cursor >= latestBlock,
    });
  } catch (err) {
    console.error('sync-chain-events error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '同步失败' },
      { status: 500 },
    );
  } finally {
    if (redis) await redis.del(LOCK_KEY);
  }
}

async function persistCursor(cursor: bigint) {
  await supabaseAdmin
    .from('system_kv')
    .update({ value: String(cursor), updated_at: new Date().toISOString() })
    .eq('key', 'last_synced_block');
}
