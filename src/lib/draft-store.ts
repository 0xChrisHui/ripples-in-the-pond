import type { KeyEvent } from '@/src/types/jam';

const STORAGE_KEY = 'ripples_drafts';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

/** localStorage 中存储的单条草稿 */
export interface Draft {
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），24h TTL 从此算起 */
  createdAt: string;
}

/** 读取所有未过期草稿 */
export function getDrafts(): Draft[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  const all: Draft[] = JSON.parse(raw);
  const now = Date.now();
  return all.filter((d) => now - new Date(d.createdAt).getTime() < TTL_MS);
}

/** 保存一条草稿（同一 trackId 覆盖旧的） */
export function saveDraft(draft: Draft): void {
  const existing = getDrafts();
  const filtered = existing.filter((d) => d.trackId !== draft.trackId);
  filtered.push(draft);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** 删除指定 trackId 的草稿（上传成功后调用） */
export function removeDraft(trackId: string): void {
  const existing = getDrafts();
  const filtered = existing.filter((d) => d.trackId !== trackId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
