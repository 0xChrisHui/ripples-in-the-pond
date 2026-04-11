// Phase 3 S1：生成 100 张测试封面到 data/covers/
// 用法：npx tsx scripts/arweave/generate-covers.ts
// 产物：
//   data/covers/001.svg ~ 100.svg  — SVG 封面文件
//   data/covers/preview.html        — 100 张缩略图网格预览
//
// 风格：深色渐变背景（每张色相不同）+ 6 条抽象 sine 波形 + 右下角编号
// 特性：seed 化（编号确定性），可任意重跑，零外部依赖

import '../_env';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TOTAL = 100;
const SIZE = 1000;
const OUTPUT_DIR = join(process.cwd(), 'data', 'covers');

// ---- seed 化 RNG（mulberry32） ----
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- HSL 转 HEX ----
function hslHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ---- 单张封面 SVG 生成 ----
function generateCover(n: number): string {
  const r = rng(n * 7919); // 大素数 seed 扩散
  const hue = (n * 3.6) % 360;

  // 背景渐变：同色系深色两点
  const bgStart = hslHex(hue, 55, 8);
  const bgEnd = hslHex((hue + 40) % 360, 65, 14);

  // 6 条波形（每条独立振幅/频率/相位/颜色/透明度）
  const waves: string[] = [];
  for (let i = 0; i < 6; i++) {
    const amp = 50 + r() * 180;
    const freq = 0.003 + r() * 0.009;
    const phase = r() * Math.PI * 2;
    const cy = 250 + r() * 500;
    const waveHue = (hue + i * 30 + r() * 60) % 360;
    const color = hslHex(waveHue, 75, 55 + r() * 20);
    const opacity = (0.45 + r() * 0.5).toFixed(2);
    const sw = (1.8 + r() * 3).toFixed(1);

    // 生成 path 点
    let d = `M 0 ${cy.toFixed(1)}`;
    for (let x = 10; x <= SIZE; x += 10) {
      const y = cy + Math.sin(x * freq + phase) * amp;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    waves.push(
      `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" opacity="${opacity}" stroke-linecap="round" />`,
    );
  }

  const label = `Ripples #${String(n).padStart(3, '0')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}" />
      <stop offset="100%" stop-color="${bgEnd}" />
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />
  ${waves.join('\n  ')}
  <text x="${SIZE - 40}" y="${SIZE - 30}" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="300" fill="#ffffff" text-anchor="end" opacity="0.85">${label}</text>
</svg>
`;
}

// ---- 预览 HTML ----
function generatePreviewHtml(count: number): string {
  const items: string[] = [];
  for (let i = 1; i <= count; i++) {
    const name = `${String(i).padStart(3, '0')}.svg`;
    items.push(
      `    <a href="${name}" target="_blank"><img src="${name}" alt="${name}" loading="lazy" /></a>`,
    );
  }
  return `<!DOCTYPE html>
<html lang="zh"><head>
<meta charset="utf-8" />
<title>Ripples covers — ${count} 张预览</title>
<style>
  body { background:#0a0a0a; color:#eee; font-family: system-ui, sans-serif; margin:0; padding:24px; }
  h1 { font-weight:300; font-size:22px; margin:0 0 20px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
  .grid a { display:block; border-radius:6px; overflow:hidden; background:#1a1a1a; transition: transform .15s; }
  .grid a:hover { transform: scale(1.04); box-shadow: 0 6px 20px rgba(0,0,0,.6); }
  .grid img { width:100%; height:auto; display:block; }
  .hint { margin-top:28px; color:#888; font-size:13px; }
</style></head>
<body>
<h1>Ripples in the Pond — ${count} 张封面预览</h1>
<div class="grid">
${items.join('\n')}
</div>
<p class="hint">这些是 S1.a 生成的 SVG 封面，尚未上传 Arweave。点击任一张查看原图。风格 OK 才继续 S1.b 上链。</p>
</body></html>
`;
}

// ---- main ----
function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`生成 ${TOTAL} 张封面 → ${OUTPUT_DIR}`);
  for (let i = 1; i <= TOTAL; i++) {
    const svg = generateCover(i);
    const name = `${String(i).padStart(3, '0')}.svg`;
    writeFileSync(join(OUTPUT_DIR, name), svg);
  }

  const previewPath = join(OUTPUT_DIR, 'preview.html');
  writeFileSync(previewPath, generatePreviewHtml(TOTAL));

  console.log(`\n✅ 完成`);
  console.log(`   ${TOTAL} 张 SVG 已写到 ${OUTPUT_DIR}`);
  console.log(`   预览页面 ${previewPath}`);
  console.log(`\n下一步: 用浏览器打开 preview.html`);
  console.log(`   Windows 资源管理器直接双击，或者复制下面地址粘到浏览器：`);
  console.log(`   file:///${previewPath.replace(/\\/g, '/')}`);
}

main();
