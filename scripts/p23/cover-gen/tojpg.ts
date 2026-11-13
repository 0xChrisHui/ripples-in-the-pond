// PNG 母版 → JPG(800px, q85, mozjpeg)，每种风格取前 N 张；输出 manifest（含 sha256、字节数、轮转顺序）。
// 用法：npx tsx scripts/p23/cover-gen/tojpg.ts <母版根> <输出根> [每种张数=50]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const STYLES = 'AEFJKMNOSUVX'.split('');

async function main() {
  const [src, out, per = '50'] = process.argv.slice(2);
  if (!src || !out) throw new Error('缺参数');
  mkdirSync(out, { recursive: true });
  const seeds = new Map<string, number>();
  for (const s of STYLES) {
    const m = JSON.parse(readFileSync(join(src, s, 'manifest.json'), 'utf8'));
    for (const it of m.items) seeds.set(`${s}${it.n}`, it.seed);
  }
  const items: { order: number; style: string; n: number; seed: number; file: string; bytes: number; sha256: string }[] = [];
  // 轮转顺序：第 1 轮 A…X 各第 1 张，第 2 轮各第 2 张…，相邻两张必为不同风格
  let order = 0;
  for (let n = 1; n <= Number(per); n++) {
    for (const s of STYLES) {
      order++;
      const name = `${s}-${String(n).padStart(3, '0')}.jpg`;
      const buf = await sharp(join(src, s, `${String(n).padStart(3, '0')}.png`))
        .resize(800, 800).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      writeFileSync(join(out, name), buf);
      items.push({ order, style: s, n, seed: seeds.get(`${s}${n}`)!, file: name, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
    }
    if (n % 10 === 0) console.log(`${n}/${per} 轮`);
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ format: 'jpeg', size: 800, quality: 85, count: items.length, items }, null, 1));
  const total = items.reduce((a, x) => a + x.bytes, 0);
  const kb = (b: number) => (b / 1024).toFixed(0);
  console.log(`完成 ${items.length} 张，合计 ${(total / 1048576).toFixed(0)}MB，均值 ${kb(total / items.length)}KB，最大 ${kb(Math.max(...items.map((x) => x.bytes)))}KB，≤105KB ${items.filter((x) => x.bytes <= 105 * 1024).length} 张`);
}
main();
