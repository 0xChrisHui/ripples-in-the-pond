// P19 词典一致性检查：中英 key 集合相同、{占位符} 一致、无空值；译文与中文相同或含中文字符只提示复核。
// 用法：node scripts/i18n/check-messages.mjs [词典目录，默认 src/i18n/messages]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'src/i18n/messages';
const load = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));

/** 展平为 { 'ns.key': '文案' }；遇到非字符串、非对象的值记为结构错误 */
function flatten(tree, prefix, out, errors, lang) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out, errors, lang);
    else errors.push(`${lang} ${path}：值必须是字符串或对象`);
  }
  return out;
}

/**
 * ICU 参数名：{name}、{count, plural, ...}、{state, select, ...} 里的 name / count / state，
 * 以及 plural/select 分支子消息里再出现的参数；分支内容本身（如 {暂停}、{Pause}、{# 首}）不算参数。
 */
function placeholders(text) {
  const names = new Set();
  let i = 0;
  const message = (stopAtBrace) => {
    while (i < text.length) {
      if (text[i] === '}' && stopAtBrace) { i++; return; }
      if (text[i] === '{') { i++; argument(); } else i++;
    }
  };
  const read = (stops) => { const start = i; while (i < text.length && !stops.includes(text[i])) i++; return text.slice(start, i).trim(); };
  const argument = () => {
    const name = read([',', '}']);
    if (name) names.add(name);
    if (text[i] === '}') { i++; return; }
    i++; // 跳过 ','
    const type = read([',', '}']);
    if (text[i] === '}') { i++; return; }
    i++;
    if (!['plural', 'select', 'selectordinal'].includes(type)) { read(['}']); i++; return; }
    while (i < text.length) {
      while (/\s/.test(text[i] ?? '')) i++;
      if (text[i] === '}') { i++; return; }
      read(['{', '}']); // 分支键：one / other / =0 / offset:1 …
      if (text[i] === '{') { i++; message(true); }
    }
  };
  message(false);
  return [...names].sort();
}
const HAN = /[㐀-鿿]/;

const errors = [];
const warnings = [];
const zh = flatten(load('zh'), '', {}, errors, 'zh');
const en = flatten(load('en'), '', {}, errors, 'en');

for (const [path, zhText] of Object.entries(zh)) {
  const enText = en[path];
  if (enText === undefined) { errors.push(`en 缺 key：${path}`); continue; }
  if (!zhText.trim()) errors.push(`zh ${path}：空文案`);
  if (!enText.trim()) errors.push(`en ${path}：空文案`);
  const a = placeholders(zhText).join(',');
  const b = placeholders(enText).join(',');
  if (a !== b) errors.push(`${path}：占位符不一致 zh{${a}} / en{${b}}`);
  if (enText === zhText) warnings.push(`${path}：译文与中文完全相同，请确认是否专有名词`);
  else if (HAN.test(enText)) warnings.push(`${path}：英文译文含中文字符，请确认是否有意保留`);
}
for (const path of Object.keys(en)) if (!(path in zh)) errors.push(`en 多出 key（中文没有）：${path}`);

warnings.forEach((w) => console.log(`⚠ ${w}`));
errors.forEach((e) => console.log(`❌ ${e}`));
console.log(errors.length
  ? `❌ 词典检查失败：${errors.length} 个错误，${warnings.length} 个提示（${dir}）`
  : `✅ 词典检查通过：${Object.keys(zh).length} 个 key，${warnings.length} 个提示（${dir}）`);
process.exit(errors.length ? 1 : 0);
