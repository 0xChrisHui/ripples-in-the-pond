// 校验 JPG 池：数量、文件存在且尺寸 800×800、sha256 唯一、亮度离群、相邻风格不同。
// 用法：npx tsx scripts/p23/cover-gen/verify-jpg.ts <jpg 目录>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('缺目录');
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const seen = new Set<string>();
  let bad = 0;
  const means: { file: string; style: string; mean: number }[] = [];
  for (const it of m.items) {
    const buf = readFileSync(join(dir, it.file));
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== it.sha256) { bad++; console.log('哈希不符', it.file); }
    if (seen.has(sha)) { bad++; console.log('重复', it.file); }
    seen.add(sha);
    const meta = await sharp(buf).metadata();
    if (meta.width !== 800 || meta.height !== 800 || meta.format !== 'jpeg') { bad++; console.log('规格异常', it.file, meta.width, meta.height, meta.format); }
    const { data } = await sharp(buf).resize(100, 100).greyscale().raw().toBuffer({ resolveWithObject: true });
    means.push({ file: it.file, style: it.style, mean: data.reduce((a, v) => a + v, 0) / data.length });
  }
  for (let i = 1; i < m.items.length; i++) if (m.items[i].style === m.items[i - 1].style) { bad++; console.log('相邻同风格', m.items[i].file); }
  const styles = [...new Set(means.map((x) => x.style))];
  let outliers = 0;
  for (const s of styles) {
    const r = means.filter((x) => x.style === s);
    const mu = r.reduce((a, x) => a + x.mean, 0) / r.length;
    const sd = Math.sqrt(r.reduce((a, x) => a + (x.mean - mu) ** 2, 0) / r.length) || 1;
    const lo = Math.min(...r.map((x) => x.mean)), hi = Math.max(...r.map((x) => x.mean));
    console.log(`${s}: ${r.length}张 亮度 ${lo.toFixed(0)}–${hi.toFixed(0)}（均值 ${mu.toFixed(0)}）`);
    for (const x of r) if (Math.abs(x.mean - mu) > 3 * sd) { outliers++; console.log(`  离群 ${x.file} 亮度 ${x.mean.toFixed(1)}`); }
  }
  console.log(`总数 ${m.items.length}，唯一 ${seen.size}，问题 ${bad}，亮度离群 ${outliers}`);
}
main();
