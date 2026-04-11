// 一次性上传 public/sounds/*.mp3 到 Arweave + 顺便上传 sound map JSON 自身
// 用法：npx tsx scripts/arweave/upload-sounds.ts
// 产物：
//   data/sounds-ar-map.json       (key -> { txId, url }) ← 26 个音效 txid
//   data/sounds-map-ar.json       map 文件自身的 Arweave txid（S5 decoder 用）
// 增量：音效部分已在 map 里的 key 会跳过，可反复运行
//       map 上传：每次都重传，但 Arweave 内容寻址 → 同内容拿到同 txid，无额外成本
// 前置：TURBO_WALLET_PATH 已配置 + Turbo credits 已到账

import '../_env';
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const SOUNDS_DIR = join(ROOT, 'public', 'sounds');
const OUTPUT_DIR = join(ROOT, 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'sounds-ar-map.json');

type ArMap = Record<string, { txId: string; url: string }>;

function loadMap(): ArMap {
  if (!existsSync(OUTPUT_FILE)) return {};
  return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8')) as ArMap;
}

function saveMap(map: ArMap): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2) + '\n');
}

async function main() {
  if (!existsSync(SOUNDS_DIR)) {
    throw new Error(`Sounds dir not found: ${SOUNDS_DIR}`);
  }
  const files = readdirSync(SOUNDS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();
  console.log(`发现 ${files.length} 个音效文件 (${SOUNDS_DIR})`);

  const map = loadMap();
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const key = file.replace(/\.mp3$/i, '');
    if (map[key]) {
      console.log(`⏭  ${key} 已存在 (${map[key].txId})`);
      skipped++;
      continue;
    }
    console.log(`⬆  ${key} 上传中...`);
    const buf = readFileSync(join(SOUNDS_DIR, file));
    const { txId, url } = await uploadBuffer(buf, 'audio/mpeg');
    map[key] = { txId, url };
    saveMap(map); // 每成功一个就落盘，避免中途挂掉丢进度
    console.log(`✅ ${key} → ${txId}`);
    uploaded++;
  }

  console.log(`\n完成：上传 ${uploaded}，跳过 ${skipped}`);
  console.log(`输出：${OUTPUT_FILE}`);

  // 追加步骤（S5.b 需要）：把 sounds-ar-map.json 自身也上传到 Arweave
  // 这样 decoder 的 ?sounds= URL 参数能指向它，获得完整的 26 音效 txid 映射
  const mapJson = JSON.stringify(map, null, 2);
  const mapBuf = Buffer.from(mapJson, 'utf-8');
  console.log(`\n⬆  上传 sound map 自身 (${mapBuf.length} bytes)...`);
  const mapUpload = await uploadBuffer(mapBuf, 'application/json');
  const mapRecord = {
    txId: mapUpload.txId,
    url: mapUpload.url,
    uploadedAt: new Date().toISOString(),
    sizeBytes: mapBuf.length,
    entries: Object.keys(map).length,
  };
  writeFileSync(
    join(OUTPUT_DIR, 'sounds-map-ar.json'),
    JSON.stringify(mapRecord, null, 2) + '\n',
  );
  console.log(`✅ sound map → ${mapUpload.txId}`);
  console.log(`\n下一步：把这一行加进 .env.local：`);
  console.log(`  SOUNDS_MAP_AR_TX_ID=${mapUpload.txId}`);
}

main().catch((e) => {
  console.error('[upload-sounds] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});
