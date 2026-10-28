import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HARD_MAX, SOFT_TARGET, notesToSnippets, splitLine, splitNote } from '../../src/components/pond-gl-test3/decor/bubbles/notes/snippet-split';
import { loadSnippetPool, pickSnippet, type NoteSources } from '../../src/components/pond-gl-test3/decor/bubbles/notes/snippet-pool';

const len = (s: string) => [...s].length;
const squash = (s: string) => s.replace(/\s+/g, '');

async function main(): Promise<void> {
  // 中文：短行整行保留，空行丢弃，不跨行拼接
  assert.deepEqual(splitNote('第一行。\n\n第二行', 'zh'), ['第一行。', '第二行']);
  // 英文：只有一句的行
  assert.deepEqual(splitNote('Slowly, a little emerges.', 'en'), ['Slowly, a little emerges.']);
  // 空行 / 纯空白
  assert.deepEqual(splitNote('', 'zh'), []);
  assert.deepEqual(splitNote('  \n\t\n　\n', 'en'), []);
  assert.deepEqual(splitLine('   ', 'en'), []);
  // 不跨行：两短行不合并
  assert.equal(splitNote('a b c.\nd e f.', 'en').length, 2);

  // 中文超长行：句末优先，每片不超硬上限，拼回去不丢字
  const zhLong = Array.from({ length: 6 }, (_, i) => `${'字'.repeat(40 + i)}。`).join('');
  const zhParts = splitLine(zhLong, 'zh');
  assert.ok(zhParts.length > 1);
  assert.ok(zhParts.every((p) => len(p) <= HARD_MAX.zh && p.endsWith('。')));
  assert.equal(zhParts.join(''), zhLong);
  // 中文无标点超长：硬切
  const zhRaw = '字'.repeat(HARD_MAX.zh * 2 + 5);
  const zhRawParts = splitLine(zhRaw, 'zh');
  assert.ok(zhRawParts.every((p) => len(p) <= HARD_MAX.zh));
  assert.equal(zhRawParts.join(''), zhRaw);
  // 中文单句过长：落到分句标点
  const zhClause = `${'甲'.repeat(100)}，${'乙'.repeat(100)}。`;
  const zhClauseParts = splitLine(zhClause, 'zh');
  assert.deepEqual(zhClauseParts, [`${'甲'.repeat(100)}，`, `${'乙'.repeat(100)}。`]);

  // 英文超长：句末切；小数点不切
  const enLong = Array.from({ length: 8 }, (_, i) => `This is sentence number ${i} of 3.5 words, give or take a few more here.`).join(' ');
  const enParts = splitLine(enLong, 'en');
  assert.ok(enParts.length > 1);
  assert.ok(enParts.every((p) => len(p) <= HARD_MAX.en && p.endsWith('.')));
  assert.ok(enParts.every((p) => !/\b3\.$/.test(p)));
  assert.equal(squash(enParts.join(' ')), squash(enLong));
  // 英文无标点超长：词边界，不切碎单词
  const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
  const wordParts = splitLine(words, 'en');
  assert.ok(wordParts.every((p) => len(p) <= HARD_MAX.en));
  assert.equal(wordParts.join(' '), words);
  assert.ok(wordParts.every((p) => p.split(' ').every((w) => /^word\d+$/.test(w))));

  // 片段不带编号、不暴露属于哪首
  const snippets = notesToSnippets({ '10': 'ten', '2': 'two', '1': 'one' }, 'en');
  assert.deepEqual(snippets, ['one', 'two', 'ten']);

  // 加载：中文成功、英文失败返回空且不回退中文
  let zhCalls = 0;
  const sources: NoteSources = {
    loadZhNotes: async () => { zhCalls += 1; return { '1': '中文手记。' }; },
    loadEnNotes: async () => { throw new Error('offline'); },
  };
  const origError = console.error;
  console.error = () => {};
  const enPool = await loadSnippetPool('en', sources);
  console.error = origError;
  assert.deepEqual(enPool, []);
  assert.equal(zhCalls, 0);
  assert.deepEqual(await loadSnippetPool('zh', sources), ['中文手记。']);
  console.error = () => {};
  assert.deepEqual(await loadSnippetPool('zh', { ...sources, loadZhNotes: async () => { throw new Error('x'); } }), []);
  console.error = origError;

  // 取片段：空池、单条池、不连续重复（含随机数极值）
  assert.equal(pickSnippet([], () => 0.5, null), null);
  assert.deepEqual(pickSnippet(['a'], () => 0.9, 0), { text: 'a', index: 0 });
  const pool = ['a', 'b', 'c', 'd'];
  for (const r of [0, 0.25, 0.5, 0.75, 0.999999, 1, -1]) {
    for (let last = 0; last < pool.length; last += 1) {
      const pick = pickSnippet(pool, () => r, last);
      assert.ok(pick && pick.index !== last && pick.index >= 0 && pick.index < pool.length);
    }
  }
  let seed = 7;
  const lcg = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let last: number | null = null;
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i += 1) {
    const pick = pickSnippet(pool, lcg, last);
    assert.ok(pick && pick.index !== last);
    seen.add(pick.index);
    last = pick.index;
  }
  assert.equal(seen.size, pool.length);
  let calls = 0;
  pickSnippet(pool, () => { calls += 1; return 0.1; }, null);
  assert.equal(calls, 1);

  // 真实数据统计
  const zhNotes = JSON.parse(readFileSync('src/lib/music-catalog/data/artist-notes.json', 'utf8')) as Record<string, string>;
  const enNotes = JSON.parse(readFileSync('src/i18n/content/artist-notes.en.json', 'utf8')) as Record<string, string>;
  for (const [lang, notes] of [['zh', zhNotes], ['en', enNotes]] as const) {
    const lines = Object.values(notes).flatMap((n) => n.split(/\r\n|\r|\n/)).filter((l) => l.trim() !== '');
    const out = notesToSnippets(notes, lang);
    const lens = out.map(len);
    const max = Math.max(...lens);
    const over = lens.filter((l) => l > SOFT_TARGET[lang]).length;
    assert.ok(max <= HARD_MAX[lang]);
    assert.ok(out.every((s) => s === s.trim() && s !== ''));
    // 逐行核对：片段拼回等于该行（不丢字、不跨行）
    for (const line of lines) assert.equal(squash(splitLine(line, lang).join('')), squash(line));
    console.log(`${lang}: 非空行 ${lines.length}, 片段 ${out.length}, 最短 ${Math.min(...lens)}, 最长 ${max} (硬上限 ${HARD_MAX[lang]}), 超软目标 ${over}, 条目数 ${Object.keys(notes).length}`);
  }
  console.log('note-snippets: ok');
}

main().catch((error) => { console.error(error); process.exit(1); });
