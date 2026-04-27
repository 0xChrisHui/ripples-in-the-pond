import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/chain/operator-wallet';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';

/**
 * GET /api/cron/sync-chain-events?secret=xxx
 *
 * Phase 3B — 链上 Transfer 事件同步
 * 从 system_kv.last_synced_block 开始拉 ScoreNFT Transfer 事件，
 * 写入 chain_events 表，UNIQUE(tx_hash, log_index) 防重复。
 *
 * Alchemy Free 限 10 区块/请求，所以循环分批拉，
 * 单次 cron 最多跑 MAX_ITERATIONS 批（防 Vercel 超时）。
 */

// Alchemy Free tier 限制 10 区块
const CHUNK_SIZE = 10n;
// 单次 cron 最多循环 50 批（= 500 区块），充裕覆盖 5 分钟新出的 ~150 区块
const MAX_ITERATIONS = 50;

const transferEvent = SCORE_NFT_ABI.find(
  (a) => a.type === 'event' && a.name === 'Transfer',
)!;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { data: kv } = await supabaseAdmin
      .from('system_kv')
      .select('value')
      .eq('key', 'last_synced_block')
      .single();

    let cursor = BigInt(kv?.value ?? '0');
    const startCursor = cursor;
    const latestBlock = await publicClient.getBlockNumber();

    if (cursor >= latestBlock) {
      return NextResponse.json({ synced: 0, cursor: String(cursor) });
    }

    let totalInserted = 0;
    let totalLogs = 0;
    let iterations = 0;

    // 分批循环拉取
    // Phase 6 A3：单条 upsert 失败立刻 return，不推进 cursor 越过失败 batch
    //   已成功的前面 batch 持久化保留；失败 batch 下次 cron 全量重做
    //   onConflict ignoreDuplicates 保证重做幂等
    while (cursor < latestBlock && iterations < MAX_ITERATIONS) {
      const from = cursor + 1n;
      const to = from + CHUNK_SIZE - 1n < latestBlock
        ? from + CHUNK_SIZE - 1n
        : latestBlock;

      const logs = await publicClient.getLogs({
        address: SCORE_NFT_ADDRESS,
        event: transferEvent,
        fromBlock: from,
        toBlock: to,
      });

      totalLogs += logs.length;

      for (const log of logs) {
        const { error } = await supabaseAdmin.from('chain_events').upsert(
          {
            contract: SCORE_NFT_ADDRESS,
            event_name: 'Transfer',
            tx_hash: log.transactionHash,
            log_index: log.logIndex,
            block_number: Number(log.blockNumber),
            from_addr: log.args.from as string,
            to_addr: log.args.to as string,
            token_id: Number(log.args.tokenId),
            raw_data: {
              from: log.args.from,
              to: log.args.to,
              tokenId: String(log.args.tokenId),
            },
          },
          { onConflict: 'tx_hash,log_index', ignoreDuplicates: true },
        );
        if (error) {
          console.error(
            `[sync] upsert failed at block ${Number(log.blockNumber)} tx=${log.transactionHash}:`,
            error,
          );
          // 已成功的前面 batch 持久化（cursor 已推进过 startCursor）
          if (cursor > startCursor) {
            await supabaseAdmin
              .from('system_kv')
              .update({ value: String(cursor), updated_at: new Date().toISOString() })
              .eq('key', 'last_synced_block');
          }
          return NextResponse.json(
            {
              result: 'partial',
              synced: totalInserted,
              stoppedAt: Number(log.blockNumber),
              cursor: String(cursor),
              error: error.message,
            },
            { status: 200 },
          );
        }
        totalInserted++;
      }

      // 整个 batch 全部 upsert 成功，cursor 推进到 to
      cursor = to;
      iterations++;
    }

    // 全部 batch 成功 → 推进 cursor
    await supabaseAdmin
      .from('system_kv')
      .update({ value: String(cursor), updated_at: new Date().toISOString() })
      .eq('key', 'last_synced_block');

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
  }
}
