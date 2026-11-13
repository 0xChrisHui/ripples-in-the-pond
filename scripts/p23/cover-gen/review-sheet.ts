// 为封面池生成带文件名的风格总览与可点击的本地验收页。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

async function main() {
  const pool = 'data/p23/cover-pool', out = 'data/p23/review';
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(pool, 'manifest.json'), 'utf8'));
  const items = manifest.items as { style: string; file: string }[];
  let html = '<!doctype html><meta charset="utf-8"><title>600 张 Score 封面验收</title><style>body{background:#111;color:#ddd;font:14px sans-serif}section{display:grid;grid-template-columns:repeat(10,1fr);gap:8px}img{width:100%}a{color:inherit;text-align:center}</style>';
  for (const style of [...new Set(items.map((x) => x.style))]) {
    const group = items.filter((x) => x.style === style);
    const tiles = await Promise.all(group.map(async (x, i) => ({
      input: await sharp(join(pool, x.file)).resize(160, 160).extend({ bottom: 22, background: '#111' })
        .composite([{ input: Buffer.from(`<svg width="160" height="22"><text x="80" y="16" fill="white" text-anchor="middle" font-size="13">${x.file}</text></svg>`), top: 160, left: 0 }]).toBuffer(),
      left: i % 10 * 160, top: Math.floor(i / 10) * 182,
    })));
    await sharp({ create: { width: 1600, height: 910, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 92 }).toFile(join(out, `sheet-${style}.jpg`));
    html += `<h2>${style}</h2><section>${group.map((x) => `<a href="../cover-pool/${x.file}" target="_blank"><img src="../cover-pool/${x.file}">${x.file}</a>`).join('')}</section>`;
  }
  writeFileSync(join(out, 'index.html'), html);
  console.log('12 张总览与 index.html 已生成');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
