// 只读：仅 Supabase select 与网关 GET，不写任何东西。
// 运行：npx tsx --conditions=react-server scripts/p14-j/verify-failed-orders-live.ts
import '../_env';
import { supabaseAdmin } from '../../src/lib/supabase';
import { attestPermanentResource } from '../../src/lib/permanent-core/attestation';

async function main(): Promise<void> {
  const { data: rows, error } = await supabaseAdmin.from('score_nft_queue')
    .select('id, events_ar_tx_id, events_sha256, events_bytes, events_mime')
    .eq('status', 'failed').order('created_at', { ascending: true });
  if (error) throw new Error(`失败订单读取失败：${error.message}`);
  let passed = 0;
  for (const row of rows ?? []) {
    try {
      if (!row.events_ar_tx_id || !row.events_sha256 || !row.events_bytes || !row.events_mime) {
        throw new Error('events 永久身份不完整');
      }
      await attestPermanentResource({
        arTxId: row.events_ar_tx_id, sha256: row.events_sha256,
        bytes: row.events_bytes, mime: row.events_mime,
      });
      passed += 1;
      console.log(`${row.id}：通过`);
    } catch (caught) {
      console.error(`${row.id}：未通过，${caught instanceof Error ? caught.message : String(caught)}`);
    }
  }
  const total = rows?.length ?? 0;
  console.log(`只读校验：${passed}/${total} 通过（本轮预期 5/5）`);
  if (total !== 5 || passed !== total) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
