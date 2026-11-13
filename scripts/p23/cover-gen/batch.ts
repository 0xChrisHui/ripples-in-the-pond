// 批量出图：某一种风格 × N 张 PNG，种子 = (字母码*1000+序号)*7919（前 3 张与样图一致）。
// 用法：npx tsx scripts/p23/cover-gen/batch.ts <风格字母> <输出根目录> [张数=100]
// 产物：<输出根>/<字母>/001.png…，以及 <输出根>/<字母>/manifest.json（序号、种子、sha256、字节数）
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { rng, styleA } from './lib';
import { styleE } from './styles/styleE';
import { styleF, styleJ } from './styles/styles2';
import { styleK, styleM, styleN, styleO } from './styles/styles3';
import { styleS } from './styles/styles4';
import { styleU, styleV, styleX } from './styles/styles5';

const STYLES: Record<string, (r: () => number) => string> = {
  A: styleA, E: styleE, F: styleF, J: styleJ, K: styleK, M: styleM,
  N: styleN, O: styleO, S: styleS, U: styleU, V: styleV, X: styleX,
};

async function main() {
  const [key, root, count = '100'] = process.argv.slice(2);
  const fn = STYLES[key];
  if (!fn || !root) throw new Error('用法: batch.ts <A|E|F|J|K|M|N|O|S|U|V|X> <输出根目录> [张数]');
  const dir = join(root, key);
  mkdirSync(dir, { recursive: true });
  const items: { n: number; seed: number; sha256: string; bytes: number }[] = [];
  const t0 = Date.now();
  for (let n = 1; n <= Number(count); n++) {
    const seed = (key.charCodeAt(0) * 1000 + n) * 7919;
    const png = await sharp(Buffer.from(fn(rng(seed)))).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(join(dir, `${String(n).padStart(3, '0')}.png`), png);
    items.push({ n, seed, sha256: createHash('sha256').update(png).digest('hex'), bytes: png.length });
    if (n % 20 === 0) console.log(`${key} ${n}/${count} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ style: key, items }, null, 1));
  console.log(`${key} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
main();
