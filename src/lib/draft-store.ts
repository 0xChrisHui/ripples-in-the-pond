import type { KeyEvent } from '@/src/types/jam';
import { DRAFT_TTL_MS } from '@/src/lib/constants';

const STORAGE_KEY = 'ripples_drafts';

/** localStorage 中存储的单条草稿 */
export interface Draft {
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），24h TTL 从此算起 */
  createdAt: string;
}

/**
 * Phase 6 B5 #9：rune-time 验证 localStorage 里的 Draft，防损坏数据让 /me 崩
 * 任一字段类型不对就视为无效条目，整个 raw 损坏（非 array / parse 失败）就清空
 */
function isValidDraft(d: unknown): d is Draft {
  if (typeof d !== 'object' || d === null) return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.trackId === 'string' &&
    Array.isArray(r.eventsData) &&
    typeof r.createdAt === 'string'
  );
}

/** 读取所有未过期且字段合法的草稿；任何异常自动清空 localStorage */
export function getDrafts(): Draft[] {
  if (typeof window === 'undefined') return [];

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('drafts not array');
    const valid = parsed.filter(isValidDraft);
    const now = Date.now();
    return valid.filter((d) => now - new Date(d.createdAt).getTime() < DRAFT_TTL_MS);
  } catch (err) {
    console.warn('[draft-store] localStorage 损坏，已清空:', err);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
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
