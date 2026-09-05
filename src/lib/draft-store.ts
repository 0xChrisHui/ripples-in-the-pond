import type { KeyEvent } from '@/src/types/jam';
import { DRAFT_TTL_MS } from '@/src/lib/constants';

const STORAGE_KEY = 'ripples_drafts';

/** localStorage 中存储的单条草稿 */
export interface Draft {
  /** 同一份本机草稿跨重进页面、跨标签上传时保持不变。 */
  clientDraftId: string;
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），24h TTL 从此算起 */
  createdAt: string;
}

/**
 * Phase 6 B5 #9：rune-time 验证 localStorage 里的 Draft，防损坏数据让 /me 崩
 * 任一字段类型不对就视为无效条目，整个 raw 损坏（非 array / parse 失败）就清空
 */
type StoredDraft = Omit<Draft, 'clientDraftId'> & { clientDraftId?: unknown };

function legacyDraftId(draft: Omit<Draft, 'clientDraftId'>): string {
  const input = JSON.stringify([draft.trackId, draft.createdAt, draft.eventsData]);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parseDraft(d: unknown): Draft | null {
  if (typeof d !== 'object' || d === null) return null;
  const r = d as StoredDraft;
  const valid = (
    typeof r.trackId === 'string' &&
    Array.isArray(r.eventsData) &&
    typeof r.createdAt === 'string'
  );
  if (!valid) return null;
  const base = { trackId: r.trackId, eventsData: r.eventsData, createdAt: r.createdAt };
  const clientDraftId = typeof r.clientDraftId === 'string' && r.clientDraftId.length >= 8
    ? r.clientDraftId
    : legacyDraftId(base);
  return { ...base, clientDraftId };
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
    const valid = parsed.map(parseDraft).filter((draft): draft is Draft => draft !== null);
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
export function saveDraft(draft: Omit<Draft, 'clientDraftId'> & { clientDraftId?: string }): void {
  const existing = getDrafts();
  const filtered = existing.filter((d) => d.trackId !== draft.trackId);
  const base = { trackId: draft.trackId, eventsData: draft.eventsData, createdAt: draft.createdAt };
  const clientDraftId = draft.clientDraftId
    ?? globalThis.crypto?.randomUUID?.()
    ?? legacyDraftId(base);
  filtered.push({ ...base, clientDraftId });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** 删除指定 trackId 的草稿（上传成功后调用） */
export function removeDraft(trackId: string, clientDraftId?: string): void {
  const existing = getDrafts();
  const filtered = existing.filter((draft) => (
    draft.trackId !== trackId || (clientDraftId != null && draft.clientDraftId !== clientDraftId)
  ));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
