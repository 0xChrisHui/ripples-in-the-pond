// 上传/换血 public/sounds/*.mp3 到 Arweave + 生成 v2 音效表并上传
// 用法：
//   npx tsx scripts/arweave/upload-sounds.ts           增量：按内容 hash 判变，未变则跳过
//   npx tsx scripts/arweave/upload-sounds.ts --force    强制：所有 key 无条件重传（换血兜底）
// 产物：
//   data/sounds-ar-map.json   本地索引：key -> { txId, url, hash, name }
//   data/sounds-map-ar.json   v2 音效表自身的 Arweave txid（decoder ?sounds= 指向它）
// 换血安全（Codex P0）：旧脚本"按 key 存在即 skip"，换血时新 mp3 仍叫 a-z 会全被跳过、静默产出旧表。
//   本版按【内容 sha256】判变：内容变了必重传，内容没变才跳（Arweave 内容寻址，同内容同 txid）。
//   上传 map 前打印每 key 新旧 txid 对照 + 变化计数，换血时肉眼确认全变。
// 音效名：可选 data/sound-names.json (key->name)，缺省 name=key
//   （v2 表 name 字段；命名空间 id ≡ DB sounds.key）
// 前置：TURBO_WALLET_JWK 已配置 + Turbo credits 已到账

import '../_env';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { uploadBuffer } from '../../src/lib/arweave/core';

const ROOT = process.cwd();
const SOUNDS_DIR = join(ROOT, 'public', 'sounds');
const OUTPUT_DIR = join(ROOT, 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'sounds-ar-map.json');
const NAMES_FILE = join(OUTPUT_DIR, 'sound-names.json');

const FORCE = process.argv.includes('--force');

type ArEntry = { txId: string; url: string; hash: string; name: string };
type ArMap = Record<string, ArEntry>;
type Change = { key: string; oldTx: string | null; newTx: string; changed: boolean };

function loadMap(): ArMap {
  if (!existsSync(OUTPUT_FILE)) return {};
  return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8')) as ArMap;
}

function saveMap(map: ArMap): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2) + '\n');
}

function loadNames(): Record<string, string> {
  if (!existsSync(NAMES_FILE)) return {};
  return JSON.parse(readFileSync(NAMES_FILE, 'utf-8')) as Record<string, string>;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  if (!existsSync(SOUNDS_DIR)) throw new Error(`Sounds dir not found: ${SOUNDS_DIR}`);
  const files = readdirSync(SOUNDS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();
  console.log(`发现 ${files.length} 个音效文件 (${SOUNDS_DIR})${FORCE ? ' · --force 强制重传' : ''}`);

  const map = loadMap();
  const names = loadNames();
  const changes: Change[] = [];
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const key = file.replace(/\.mp3$/i, '');
    const buf = readFileSync(join(SOUNDS_DIR, file));
    const hash = sha256(buf);
    const prev = map[key];
    const name = names[key] ?? prev?.name ?? key;

    // 判变：有记录 && 内容 hash 相同 && 非 --force → 跳过（内容没变，重传也拿同 txid，纯浪费）
    if (prev && prev.hash === hash && !FORCE) {
      console.log(`⏭  ${key} 内容未变 (${prev.txId})`);
      map[key] = { ...prev, name }; // 顺手同步 name（names 文件可能更新了）
      changes.push({ key, oldTx: prev.txId, newTx: prev.txId, changed: false });
      skipped++;
      continue;
    }

    console.log(`⬆  ${key} 上传中...${prev ? '（换血/强制）' : '（新）'}`);
    const { txId, url } = await uploadBuffer(buf, 'audio/mpeg');
    changes.push({ key, oldTx: prev?.txId ?? null, newTx: txId, changed: !prev || prev.txId !== txId });
    map[key] = { txId, url, hash, name };
    saveMap(map); // 每成功一个就落盘，避免中途挂掉丢进度
    console.log(`✅ ${key} → ${txId}`);
    uploaded++;
  }

  console.log(`\n完成：上传 ${uploaded}，跳过 ${skipped}`);

  // 上传 map 前：打印每 key 新旧 txid 对照（换血时逐条确认全变）
  console.log('\n=== 新旧 txid 对照（key: old → new）===');
  let changedCount = 0;
  for (const c of changes) {
    if (c.changed) changedCount++;
    console.log(`${c.changed ? '🔄' : '  '} ${c.key}: ${c.oldTx ?? '(无)'} → ${c.newTx}`);
  }
  const allChanged = changedCount === changes.length;
  console.log(
    `\n变化 ${changedCount}/${changes.length} 个 key` +
      (allChanged ? '（全部变化）' : `（${changes.length - changedCount} 个未变——换血场景请核对是否预期）`),
  );

  // v2 音效表：{ version:2, sounds:{ key:{ txId, name } } } —— 这是钉进每枚 NFT 的永久物
  const soundsTable: Record<string, { txId: string; name: string }> = {};
  for (const key of Object.keys(map).sort()) {
    soundsTable[key] = { txId: map[key].txId, name: map[key].name };
  }
  const v2 = { version: 2, sounds: soundsTable };
  const mapBuf = Buffer.from(JSON.stringify(v2, null, 2), 'utf-8');
  console.log(`\n⬆  上传 v2 音效表 (${mapBuf.length} bytes, ${Object.keys(soundsTable).length} sounds)...`);
  const mapUpload = await uploadBuffer(mapBuf, 'application/json');
  const mapRecord = {
    txId: mapUpload.txId,
    url: mapUpload.url,
    version: 2,
    uploadedAt: new Date().toISOString(),
    sizeBytes: mapBuf.length,
    entries: Object.keys(soundsTable).length,
  };
  writeFileSync(join(OUTPUT_DIR, 'sounds-map-ar.json'), JSON.stringify(mapRecord, null, 2) + '\n');
  console.log(`✅ v2 音效表 → ${mapUpload.txId}`);
  console.log('\n下一步（A4，非本脚本职责）：三环境切换 SOUNDS_MAP_AR_TX_ID + 逐环境读回确认');
  console.log('  （server-only，vercel-env-sync 现已纳入关键白名单可比对）：');
  console.log(`  SOUNDS_MAP_AR_TX_ID=${mapUpload.txId}`);
}

main().catch((e) => {
  console.error('[upload-sounds] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});
