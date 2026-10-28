// J-A3：把“网关校验失败、从未发过链上交易”的 OP 唱片订单重新放回队列。
// 默认只演练（只读 select）；加 --execute --id=<前缀,前缀> 才会写生产库，且逐笔 CAS：
// 只有该行仍是 failed/safe_retry 且 tx_hash、token_id、mint_attempted_at 全空时才复位，否则放弃。
// 运行：npx tsx --conditions=react-server scripts/p14-j/requeue-failed-scores.ts [--execute --id=ab12cd34,...]
import '../_env';
import { supabaseAdmin } from '@/src/lib/supabase';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const ids = (args.find((a) => a.startsWith('--id='))?.slice(5) ?? '').split(',').filter(Boolean);

async function main(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('score_nft_queue')
    .select('id, user_id, status, failure_kind, retry_count, tx_hash, token_id, mint_attempted_at, '
      + 'events_upload_state, package_upload_state, metadata_upload_state, created_at')
    .eq('status', 'failed').eq('failure_kind', 'safe_retry').order('created_at');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const safe = rows.filter((r) => !r.tx_hash && !r.token_id && !r.mint_attempted_at);
  for (const r of rows) {
    const ok = safe.includes(r);
    console.log(`${String(r.id).slice(0, 8)} ${String(r.created_at).slice(0, 16)} 用户=${String(r.user_id).slice(0, 8)} `
      + `events=${r.events_upload_state} package=${r.package_upload_state} metadata=${r.metadata_upload_state} `
      + (ok ? '→ 可补投（未发过链上交易）' : '→ 不可补投（已有链上痕迹，需人工）'));
  }
  if (!execute) {
    console.log(`\n演练：共 ${rows.length} 笔 failed/safe_retry，其中 ${safe.length} 笔可补投。未写库。`);
    return;
  }
  if (ids.length === 0) throw new Error('--execute 必须同时给 --id=<订单 id 前缀,...>，不允许全量');
  for (const prefix of ids) {
    const matches = safe.filter((r) => String(r.id).startsWith(prefix));
    if (matches.length !== 1) { console.error(`${prefix}：匹配 ${matches.length} 笔，跳过`); continue; }
    const id = String(matches[0].id);
    // CAS：只复位仍处于原失败态且无任何链上痕迹的行；events 已上传，复位到 uploading_events 即直接进入校验。
    const { data: done, error: updateError } = await supabaseAdmin.from('score_nft_queue').update({
      status: 'uploading_events', failure_kind: null, retry_count: 0, last_error: null,
      locked_by: null, lease_expires_at: null, updated_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'failed').eq('failure_kind', 'safe_retry')
      .is('tx_hash', null).is('token_id', null).is('mint_attempted_at', null).select('id');
    if (updateError) throw updateError;
    console.log(`${prefix}：${done?.length ? '已复位为 uploading_events' : '条件已不满足，未改动'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
