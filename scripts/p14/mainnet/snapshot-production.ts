import '../../_env';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const output = resolve(process.argv[2] ?? '');
if (process.env.NEXT_PUBLIC_CHAIN_ID !== '10' || !process.argv[2]) {
  throw new Error('用法：snapshot-production.ts <仓库外新目录>（仅 OP Mainnet）');
}
if (output.toLowerCase().startsWith(process.cwd().toLowerCase())) {
  throw new Error('生产快照必须写到仓库外');
}
if (existsSync(output)) throw new Error('快照目录已存在，拒绝覆盖');
const url = process.env.SERVER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('生产 Supabase 环境不完整');
const supabaseUrl = url;
const db = createClient(supabaseUrl, key);
const tables = [
  'users', 'auth_identities', 'tracks', 'sounds', 'mint_queue', 'mint_events',
  'pending_scores', 'score_nft_queue', 'score_covers', 'chain_events', 'system_kv',
  'jwt_blacklist', 'airdrop_rounds', 'airdrop_recipients',
] as const;

async function readTable(table: (typeof tables)[number]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  mkdirSync(output, { recursive: false });
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await readTable(table);
    counts[table] = rows.length;
    writeFileSync(join(output, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }
  const manifest = {
    createdAt: new Date().toISOString(), chainId: 10, supabaseHost: new URL(supabaseUrl).host,
    tables: tables.length, totalRows: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts, failures: [],
  };
  writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, tables: manifest.tables, totalRows: manifest.totalRows,
    failures: manifest.failures }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
