'use client';

/**
 * Phase 7 Track B B3 — Semi JWT 客户端持久化 + 订阅 store
 *
 * 后端签发的 JWT 走 localStorage（key `ripples_auth_jwt`，与 playbook D-B5 契约一致）。
 * useAuth 用 useSyncExternalStore 订阅本 store，跨 tab 通过 storage event 同步。
 *
 * **快照引用稳定性**（useSyncExternalStore 硬要求）：readSemiJwt() 返回 module 级
 * `cachedState`，同一份数据保持同一个引用；refresh() 只在值变化时替换引用 + 通知
 * listeners，否则 React 会无限 rerender。
 *
 * PoC 阶段（D-B8）：XSS 风险可接受 — 主网前重新评估"换 httpOnly cookie"。
 */

export const SEMI_JWT_KEY = 'ripples_auth_jwt';

export interface SemiJwtPayload {
  sub: string; // userId
  evm: string; // evmAddress
  exp: number; // 秒级 UNIX 时间戳
}

export interface JwtState {
  jwt: string | null;
  payload: SemiJwtPayload | null;
}

const EMPTY: JwtState = { jwt: null, payload: null };
const REFRESH_INTERVAL_MS = 60_000;

let cachedState: JwtState = EMPTY;
let snapshotInit = false;
let subscribersInit = false;
const listeners = new Set<() => void>();

function decodePayload(jwt: string): SemiJwtPayload | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  try {
    const raw = JSON.parse(atob(padded));
    if (
      typeof raw.sub !== 'string' ||
      typeof raw.evm !== 'string' ||
      typeof raw.exp !== 'number'
    ) {
      return null;
    }
    return { sub: raw.sub, evm: raw.evm, exp: raw.exp };
  } catch {
    return null;
  }
}

/** 从 localStorage 重算一次状态；过期或损坏则清掉。纯函数（不动 cachedState / listeners）。 */
function compute(): JwtState {
  if (typeof window === 'undefined') return EMPTY;
  const raw = window.localStorage.getItem(SEMI_JWT_KEY);
  if (!raw) return EMPTY;
  const payload = decodePayload(raw);
  if (!payload || Date.now() / 1000 >= payload.exp) {
    window.localStorage.removeItem(SEMI_JWT_KEY);
    return EMPTY;
  }
  return { jwt: raw, payload };
}

/** 重新读 localStorage 算最新值；若与缓存等价就保持旧引用，否则替换 + 通知。 */
function refresh(): void {
  const next = compute();
  const prev = cachedState;
  if (
    next.jwt === prev.jwt &&
    next.payload?.sub === prev.payload?.sub &&
    next.payload?.exp === prev.payload?.exp
  ) {
    return;
  }
  cachedState = next;
  listeners.forEach((l) => l());
}

/** 第一次 getSnapshot 时同步初始化 cachedState（pure，不挂副作用） */
function ensureSnapshot(): void {
  if (snapshotInit || typeof window === 'undefined') return;
  snapshotInit = true;
  cachedState = compute();
}

/** 第一次 subscribe 时挂全局副作用（定时检查 exp + 跨 tab storage 同步），全程只挂一次 */
function ensureSubscribers(): void {
  if (subscribersInit || typeof window === 'undefined') return;
  subscribersInit = true;
  window.setInterval(refresh, REFRESH_INTERVAL_MS);
  window.addEventListener('storage', (e) => {
    if (e.key === SEMI_JWT_KEY) refresh();
  });
}

/** useSyncExternalStore getSnapshot — pure，返回 cachedState 稳定引用 */
export function readSemiJwt(): JwtState {
  ensureSnapshot();
  return cachedState;
}

/** 登录成功后调（SemiLogin onSuccess 用） */
export function setSemiJwt(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEMI_JWT_KEY, token);
  refresh();
}

/** 登出 / 过期时清（useAuth.logout 用） */
export function clearSemiJwt(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SEMI_JWT_KEY);
  refresh();
}

/** useSyncExternalStore subscribe — 同 tab 内通过 listeners，跨 tab 通过 storage event */
export function subscribeSemiJwt(cb: () => void): () => void {
  ensureSnapshot();
  ensureSubscribers();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
