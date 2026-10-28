/** 手记出场的纯规则：分行 + 停留时长（P20 Step 5）。无 DOM、无随机源（随机系数由调用方传入），可单测。 */
import type { NoteLang } from './snippet-split';

export const REVEAL_STEP_MS = 300;     // 每行淡入间隔
export const BASE_STAY_MS = 3000;      // 停留 = 3 秒 + 每字
export const RESUME_FLOOR_MS = 3000;   // 悬停离开后至少再停 3 秒
export const FADE_MS = 700;            // 淡入淡出时长
const PER_CHAR_MS: Record<NoteLang, number> = { zh: 80, en: 40 }; // 中文每字 0.08 秒；英文按字符计，取一半（词均 ≈5 字符）
const MAX_LINES = 6;

/** 按句末标点分成"行"（每行独立淡入）；没有标点就是一行；超过 6 行把多出的并回最后一行。 */
export function toDisplayLines(text: string): string[] {
  const parts = text.split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= MAX_LINES) return parts.length ? parts : [text.trim()];
  const head = parts.slice(0, MAX_LINES - 1);
  return [...head, parts.slice(MAX_LINES - 1).join(' ')];
}

/** jitter ∈ [0,1)：停留时间在 ±15% 内浮动；初始停留另含逐行淡入所需时间。 */
export function stayDuration(text: string, lang: NoteLang, lineCount: number, jitter: number): number {
  const base = BASE_STAY_MS + [...text].length * PER_CHAR_MS[lang] + lineCount * REVEAL_STEP_MS;
  return base * (0.85 + 0.3 * jitter);
}
