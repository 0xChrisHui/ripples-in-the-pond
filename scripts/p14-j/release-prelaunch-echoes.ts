// J-B：把“上线前已铸造唱片、当初被排除（excluded_prelaunch）”的老用户放行为合格，交给现有空投流水线处理。
// 无需 migration：表约束允许同一条 UPDATE 同时把 eligibility/status/recipe 改成合格形态。
// 注意：register_wallet_recipe_origin 的重放校验会拒绝“资格被改过”的事件重新登记；常规 cron 只向前扫描、
// 不会重扫这些旧事件，但手工运行 scripts/p14/mainnet/reconcile-score-history.ts 会因此报错，属已知代价（见方案 97 §J-B）。
// 默认只演练；加 --execute --wallet=<地址前缀,...> 才写库，逐行 CAS（仍是 excluded_prelaunch 才改）。
// 运行：npx tsx --conditions=react-server scripts/p14-j/release-prelaunch-echoes.ts [--execute --wallet=0x19da,...]
import '../_env';
import { getAddress } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import { deriveRecipeV1, hashRecipeV1 } from '@/src/lib/wallet-recipe/recipe-v1';

// 生产队列在 OP 主网（链号 10）；本地 .env.local 的链号是测试网，不能用 CHAIN_ID_NUM。
const CHAIN_ID = 10;
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const wallets = (args.find((a) => a.startsWith('--wallet='))?.slice(9) ?? '').toLowerCase().split(',').filter(Boolean);

async function main(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('wallet_recipe_queue')
    .select('id, origin_wallet, origin_wallet_key, source_score_token_id, status, eligibility, token_id')
    .eq('chain_id', CHAIN_ID).eq('eligibility', 'excluded_prelaunch').order('created_at');
  if (error) throw error;
  const rows = data ?? [];
  const planned = rows.map((r) => {
    const recipe = deriveRecipeV1(getAddress(r.origin_wallet));
    return { row: r, recipe, hash: hashRecipeV1(recipe).slice(2) };
  });
  for (const p of planned) {
    console.log(`${p.row.origin_wallet} OP Score #${p.row.source_score_token_id} 现状=${p.row.status} → 放行后 recipe=${p.recipe.slice(0, 8)}…`);
  }
  if (!execute) {
    console.log(`\n演练：共 ${rows.length} 个被排除的老用户。未写库。`);
    return;
  }
  if (wallets.length === 0) throw new Error('--execute 必须同时给 --wallet=<地址前缀,...>，不允许全量');
  for (const prefix of wallets) {
    const hit = planned.filter((p) => p.row.origin_wallet_key.startsWith(prefix));
    if (hit.length !== 1) { console.error(`${prefix}：匹配 ${hit.length} 个，跳过`); continue; }
    const { row, recipe, hash } = hit[0];
    const { data: done, error: updateError } = await supabaseAdmin.from('wallet_recipe_queue').update({
      eligibility: 'eligible', status: 'pending', recipe_version: 1, recipe, recipe_hash: hash,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id).eq('eligibility', 'excluded_prelaunch').eq('status', 'excluded_prelaunch')
      .is('token_id', null).select('id');
    if (updateError) throw updateError;
    console.log(`${row.origin_wallet}：${done?.length ? '已放行为 eligible/pending' : '条件已不满足，未改动'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
