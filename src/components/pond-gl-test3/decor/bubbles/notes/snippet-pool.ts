import { notesToSnippets, type NoteLang } from './snippet-split';

export type NoteSources = {
  /** 读中文手记（曲目编号 -> 全文）；由调用方注入，默认实现见 default-sources.ts */
  loadZhNotes: () => Promise<Record<string, string>>;
  /** 读英文手记；同上 */
  loadEnNotes: () => Promise<Record<string, string>>;
};

/**
 * 取某语言的片段池。哪一边加载失败都返回空数组，绝不拿另一种语言顶替
 * （英文模式下不能出现中文手记）。
 */
export async function loadSnippetPool(lang: NoteLang, sources: NoteSources): Promise<string[]> {
  try {
    const notes = await (lang === 'en' ? sources.loadEnNotes() : sources.loadZhNotes());
    return notesToSnippets(notes, lang);
  } catch (error) {
    console.error(`[notes] ${lang} 手记加载失败，本次不出手记`, error);
    return [];
  }
}

export type SnippetPick = { text: string; index: number };

/**
 * 随机取一条，尽量不与上一条（lastIndex）连续重复。
 * random 由调用方传入（返回 [0,1)），本函数只在"出一条手记"时被调用一次。
 * 池里只有一条时无法避免重复；池为空返回 null。
 */
export function pickSnippet(
  pool: readonly string[], random: () => number, lastIndex: number | null,
): SnippetPick | null {
  const n = pool.length;
  if (n === 0) return null;
  const unit = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  const avoid = lastIndex !== null && lastIndex >= 0 && lastIndex < n && n > 1;
  let index = Math.floor(unit * (avoid ? n - 1 : n));
  if (avoid && index >= (lastIndex as number)) index += 1;
  return { text: pool[index] as string, index };
}
