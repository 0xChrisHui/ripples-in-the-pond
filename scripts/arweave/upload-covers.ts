// Phase 3 S1.b：上传 data/covers/*.svg 到 Arweave + 写 score_covers 表
// 用法：npx tsx scripts/arweave/upload-covers.ts
// 前置：
//   1. generate-covers.ts 已跑过（data/covers/ 下有 SVG）
//   2. Supabase 已执行 migration 008（score_covers 表存在）
//   3. .env.local 有 TURBO_WALLET_PATH + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//
// 行为：
//   - 增量：data/cover-arweave-map.json 里已有的 key 跳过重传
//   - 每上传成功一个立刻落盘 map + upsert score_covers（中断可续跑）
//   - Supabase upsert 用 ignoreDuplicates 防重

import '../_env';
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const COVERS_DIR = join(ROOT, 'data', 'covers');
const OUTPUT_DIR = join(ROOT, 'data');
const MAP_FILE = join(OUTPUT_DIR, 'cover-arweave-map.json');

type CoverEntry = { txId: string; url: string };
type CoverMap = Record<string, CoverEntry>;

function loadMap(): CoverMap {
  if (!existsSync(MAP_FILE)) return {};
  return JSON.parse(readFileSync(MAP_FILE, 'utf-8')) as CoverMap;
}

function saveMap(map: CoverMap): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + '\n');
}

async function main() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(supaUrl, supaKey);

  if (!existsSync(COVERS_DIR)) {
    throw new Error(`找不到 ${COVERS_DIR}，先跑 generate-covers.ts`);
  }
  const files = readdirSync(COVERS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.svg'))
    .sort();
  console.log(`发现 ${files.length} 张 SVG 封面`);

  const map = loadMap();
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const baseName = file.replace(/\.svg$/i, '');
    let entry: CoverEntry;

    if (map[baseName]) {
      entry = map[baseName];
      console.log(`⏭  ${baseName} 已上传 (${entry.txId})`);
      skipped++;
    } else {
      console.log(`⬆  ${baseName} 上传中...`);
      const buf = readFileSync(join(COVERS_DIR, file));
      const result = await uploadBuffer(buf, 'image/svg+xml');
      entry = result;
      map[baseName] = entry;
      saveMap(map); // 成功一个立刻落盘
      console.log(`✅ ${baseName} → ${entry.txId}`);
      uploaded++;
    }

    // upsert 到 score_covers：ar_tx_id 是 unique，重复跳过
    const { error } = await supabase
      .from('score_covers')
      .upsert(
        { ar_tx_id: entry.txId, usage_count: 0 },
        { onConflict: 'ar_tx_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  // 最后确认表的行数
  const { count, error: countErr } = await supabase
    .from('score_covers')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;

  console.log(`\n完成：上传 ${uploaded}，跳过 ${skipped}`);
  console.log(`score_covers 表现有 ${count} 条记录`);
  console.log(`map 文件: ${MAP_FILE}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
