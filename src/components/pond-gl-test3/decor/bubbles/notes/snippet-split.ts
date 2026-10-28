/** P20 Step 4：把手记切成"片段"。纯函数，无 DOM、无随机、无加载。 */

export type NoteLang = 'zh' | 'en';

/** 软目标：片段尽量不超过它（playbook D5：中文 80 字、英文 180 字符） */
export const SOFT_TARGET: Record<NoteLang, number> = { zh: 80, en: 180 };

/**
 * 硬上限 = "手记宽度下 6 行"，落成字符数。
 * 换算依据（估算，未做真实排版测量）：手记栏每行约 24 个汉字（全角 1em）、约 40 个英文字符
 * （英文平均字宽约 0.55em），6 行即中文 144、英文 240。Step 5 定下手记宽度后若实测不符，只改这里。
 */
export const HARD_MAX: Record<NoteLang, number> = { zh: 144, en: 240 };

// 句末：中文标点后直接断；英文 "." 必须后跟空白或行尾（避免切开 "3.5"）；后面可跟收尾引号括号与空白
const SENTENCE_END = /(?:[。！？…]+|[!?]+|\.+(?=\s|$))[”’」』"')）]*\s*/g;
// 分句：逗号、顿号、分号、冒号、破折号
const CLAUSE_END = /(?:[，、；：,;:]|—+)[”’」』"')）]*\s*/g;

const len = (text: string): number => [...text].length;

/** 在每个匹配之后切开，保留标点，不丢字符 */
function cutAfter(text: string, pattern: RegExp): string[] {
  const out: string[] = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end > start) out.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

/** 最后兜底：英文在词边界切，中文（或没有空格可用时）按字数硬切 */
function cutByWidth(text: string, max: number, lang: NoteLang): string[] {
  const out: string[] = [];
  let rest = [...text];
  while (rest.length > max) {
    let cut = max;
    if (lang === 'en') {
      const space = rest.slice(0, max + 1).lastIndexOf(' ');
      if (space > max / 2) cut = space + 1;
    }
    out.push(rest.slice(0, cut).join(''));
    rest = rest.slice(cut);
  }
  if (rest.length > 0) out.push(rest.join(''));
  return out;
}

/** 把一行拆成"不超过硬上限"的最小单位：句 -> 分句 -> 词/字 */
function toUnits(line: string, lang: NoteLang): string[] {
  const hard = HARD_MAX[lang];
  return cutAfter(line, SENTENCE_END).flatMap((sentence) => {
    if (len(sentence) <= hard) return [sentence];
    return cutAfter(sentence, CLAUSE_END).flatMap((clause) =>
      len(clause) <= hard ? [clause] : cutByWidth(clause, hard, lang));
  });
}

/**
 * 切一行（不含换行符）。行不超过硬上限就整行保留（换行是艺术家自己的断句）；
 * 超过则拆成单位后，按软目标贪心合并回片段。永不跨行。
 */
export function splitLine(rawLine: string, lang: NoteLang): string[] {
  const line = rawLine.trim();
  if (line === '') return [];
  if (len(line) <= HARD_MAX[lang]) return [line];
  const soft = SOFT_TARGET[lang];
  const out: string[] = [];
  let current = '';
  for (const unit of toUnits(line, lang)) {
    if (current !== '' && len(current) + len(unit) > soft) {
      out.push(current.trim());
      current = '';
    }
    current += unit;
  }
  if (current.trim() !== '') out.push(current.trim());
  return out;
}

/** 切一篇手记：每个非空行各自成段，不跨行拼接 */
export function splitNote(note: string, lang: NoteLang): string[] {
  return note.split(/\r\n|\r|\n/).flatMap((line) => splitLine(line, lang));
}

/** 把"曲目编号 -> 手记"摊平成片段数组；编号只用于稳定排序，不进入结果 */
export function notesToSnippets(notes: Record<string, string>, lang: NoteLang): string[] {
  return Object.keys(notes)
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((key) => splitNote(notes[key] ?? '', lang));
}
