import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const root = 'reviews/evidence/p23-score';
const metrics = JSON.parse(await readFile(`${root}/after/metrics.json`, 'utf8'));
assert.equal(metrics.length, 32, '必须完成全部32组截图与布局证据');
const results = [];
for (const row of metrics) {
  assert.ok(row.scrollWidth <= row.width, `${row.prefix} 横向溢出`);
  results.push(`${row.prefix} 无横向溢出`);
  if (!row.route.startsWith('/score/')) continue;
  const title = row.h1.find((h) => h.text.startsWith('Ripples #'));
  assert.ok(title, `${row.prefix} 缺作品标题`);
  assert.ok(Math.abs(parseFloat(title.fontSize) - (row.width < 768 ? 40 : 92)) < .1);
  assert.ok(title.fontFamily.includes('Cormorant'));
  assert.equal(row.oldHeaders, 0);
  assert.equal(row.ledgerOpen, false);
  const visible = row.hero.filter((item) => item.width > 0 && item.height > 0);
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
    const a = visible[i], b = visible[j];
    const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    assert.equal(intersects, false, `${row.prefix} 首屏元素重叠`);
  }
  if (row.prefix.endsWith('-en')) assert.ok(!/[\u4e00-\u9fff]/u.test(visible.map((x) => x.text).join('')), `${row.prefix} 首屏英文泄漏中文`);
  if (row.width < 768) assert.ok(row.height < 1900, `${row.prefix} 收起凭证时页高应低于1900px，实际${row.height}`);
  results.push(`${row.prefix} 字体/单层导航/首屏布局/默认收起/语言通过`);
}
await writeFile(`${root}/score-gate.json`, JSON.stringify({ passed: true, combinations: metrics.length, results }, null, 2));
console.log(`${metrics.length} 组页面布局，${results.length} 项作品页断言通过`);
