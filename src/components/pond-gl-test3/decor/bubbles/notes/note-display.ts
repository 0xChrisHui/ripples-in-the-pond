/** 手记出场的纯规则：分行 + 停留时长（P20 Step 5）。无 DOM、无随机源（随机系数由调用方传入），可单测。 */
import type { NoteLang } from './snippet-split';

import { DEFAULT_BUBBLE_TUNING, type BubbleTuning } from '../bubble-tuning';

const MAX_LINES = 6;

/** 按句末标点分成"行"（每行独立淡入）；没有标点就是一行；超过 6 行把多出的并回最后一行。 */
export function toDisplayLines(text: string): string[] {
  const parts = text.split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= MAX_LINES) return parts.length ? parts : [text.trim()];
  const head = parts.slice(0, MAX_LINES - 1);
  return [...head, parts.slice(MAX_LINES - 1).join(' ')];
}

type StayTuning = Pick<BubbleTuning, 'baseStay' | 'perCharZh' | 'perCharEn' | 'revealStep' | 'jitter'>;

/** rand ∈ [0,1)：停留时间在 ±jitter 内浮动；初始停留另含逐行淡入所需时间。数值来自调参表。 */
export function stayDuration(text: string, lang: NoteLang, lineCount: number, rand: number, t: StayTuning = DEFAULT_BUBBLE_TUNING): number {
  const perChar = lang === 'en' ? t.perCharEn : t.perCharZh; // 英文按字符计，默认取中文一半（词均 ≈5 字符）
  const base = t.baseStay + [...text].length * perChar + lineCount * t.revealStep;
  return base * (1 - t.jitter + 2 * t.jitter * rand);
}
