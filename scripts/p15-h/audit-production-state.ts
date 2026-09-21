// P15-H0：只读对账生产队列、草稿事件和链上同步账本，不输出用户身份。
import '../_env';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'reviews', 'evidence', 'p15-h', 'h0-production-state.json');
const CORE = join(ROOT, 'reviews', 'evidence', 'p15-h', 'h0-permanent-core.json');
const CONTRACT = '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa';

async function main() {
  const url = process.env.SERVER_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少生产 Supabase 只读审计凭证');
  const db = createClient(url, key);
  const queueResult = await db.from('score_nft_queue').select(
    'id,pending_score_id,track_id,events_ar_tx_id,metadata_ar_tx_id,token_id,token_uri,status,retry_count,last_error,tx_hash,uri_tx_hash,created_at,updated_at',
  ).order('created_at', { ascending: true });
  if (queueResult.error) throw queueResult.error;

  const queue = [];
  for (const row of queueResult.data) {
    const pending = await db.from('pending_scores').select('events_data').eq('id', row.pending_score_id).maybeSingle();
    if (pending.error) throw pending.error;
    const events = Array.isArray(pending.data?.events_data)
      ? pending.data.events_data as Array<{ key?: unknown }>
      : [];
    const usedKeys = [...new Set(events.map(({ key }) => key).filter((key): key is string => typeof key === 'string'))].sort();
    queue.push({ ...row, event_count: events.length, used_keys: usedKeys });
  }

  const chainResult = await db.from('chain_events').select(
    'tx_hash,log_index,block_number,token_id,created_at,chain_id',
  ).eq('contract', CONTRACT).eq('event_name', 'Transfer').eq('from_addr', '0x0000000000000000000000000000000000000000').order('token_id');
  if (chainResult.error) throw chainResult.error;

  const core = JSON.parse(readFileSync(CORE, 'utf8')) as { scoreNft: { tokenIds: string[] } };
  const queueTokenIds = new Set(queue.flatMap(({ token_id }) => token_id === null ? [] : [String(token_id)]));
  const chainTokenIds = new Set(chainResult.data.map(({ token_id }) => String(token_id)));
  const expected = core.scoreNft.tokenIds;
  const parity = {
    chainMissingFromQueue: expected.filter((tokenId) => !queueTokenIds.has(tokenId)),
    indexMissingFromChainEvents: expected.filter((tokenId) => !chainTokenIds.has(tokenId)),
  };

  mkdirSync(join(ROOT, 'reviews', 'evidence', 'p15-h'), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify({ schema: 'p15-h0.production-state.v1', generatedAt: new Date().toISOString(), queue, chainEvents: chainResult.data, parity }, null, 2)}\n`);
  console.log(`✅ H0 生产状态证据：${OUTPUT}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
