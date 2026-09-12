import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { publicClient } from '@/src/lib/chain/operator-wallet';
import { SCORE_NFT_ADDRESS, SCORE_NFT_ABI } from '@/src/lib/chain/contracts';
import {
  advanceSourceCursor,
  getSourceIdentity,
  readSourceCursor,
  recordSourceSyncSuccess,
  type SourceIdentity,
} from '@/src/lib/chain/source-cursor';
import {
  acquireSourceSyncLock,
  releaseSourceSyncLock,
} from '@/src/lib/chain/source-sync-lock';
import { runSourceSync, type SourceEventRow } from './sync-source';

const transferEvent = SCORE_NFT_ABI.find(
  (item) => item.type === 'event' && item.name === 'Transfer',
)!;

function safeNumber(value: bigint | undefined, label: string): number {
  if (typeof value !== 'bigint') throw new Error(`${label} 缺失`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} 超出安全整数范围`);
  return number;
}

/** ScoreNFT Transfer 只同步到 head-20；事件落库后才允许 CAS 推进 scoped cursor。 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  let identity: SourceIdentity;
  try {
    identity = getSourceIdentity();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'source identity 无效' },
      { status: 500 },
    );
  }
  const owner = randomUUID();
  try {
    const acquired = await acquireSourceSyncLock(identity, owner);
    if (!acquired) {
      return NextResponse.json({ error: 'source sync 正在运行' }, { status: 409 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'source sync 加锁失败' },
      { status: 503 },
    );
  }

  try {
    const result = await runSourceSync({
      readCursor: () => readSourceCursor(identity),
      readLatestHead: () => publicClient.getBlockNumber(),
      readLogs: async (fromBlock, toBlock) => {
        const logs = await publicClient.getLogs({
          address: SCORE_NFT_ADDRESS,
          event: transferEvent,
          fromBlock,
          toBlock,
        });
        return logs.map((log): SourceEventRow => ({
          chain_id: identity.chainId,
          contract: identity.contract,
          event_name: 'Transfer',
          tx_hash: log.transactionHash.toLowerCase(),
          log_index: log.logIndex,
          block_number: safeNumber(log.blockNumber, 'block number'),
          from_addr: String(log.args.from).toLowerCase(),
          to_addr: String(log.args.to).toLowerCase(),
          token_id: safeNumber(log.args.tokenId, 'token id'),
          raw_data: {
            from: String(log.args.from),
            to: String(log.args.to),
            tokenId: String(log.args.tokenId),
            blockHash: log.blockHash,
          },
        }));
      },
      upsertEvents: async (rows) => {
        const { error } = await supabaseAdmin.from('chain_events').upsert(rows, {
          onConflict: 'chain_id,contract,tx_hash,log_index',
          ignoreDuplicates: true,
        });
        if (error) throw new Error(`chain_events batch 写入失败：${error.message}`);
      },
      advanceCursor: (expected, next) => advanceSourceCursor(expected, next, identity),
      recordSuccess: (cursor) => recordSourceSyncSuccess(cursor, identity),
    });
    return NextResponse.json({ identity, ...result });
  } catch (error) {
    console.error('sync-chain-events error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同步失败', identity },
      { status: 500 },
    );
  } finally {
    try {
      await releaseSourceSyncLock(identity, owner);
    } catch (error) {
      console.error('source sync compare-delete 解锁失败，等待 TTL 自动释放:', error);
    }
  }
}
