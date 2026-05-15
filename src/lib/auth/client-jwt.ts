'use client';

/**
 * Phase 7 Track B B3 — Semi JWT 客户端持久化 + 订阅 store
 *
 * 后端签发的 JWT 走 localStorage（key `ripples_auth_jwt`，与 playbook D-B5 契约一致）。
 * useAuth 用 useSyncExternalStore 订阅本 store，跨 tab 通过 storage event 同步。
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

/** 读 localStorage + 自校验 exp，过期或损坏立即清掉 */
export function readSemiJwt(): JwtState {
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

/** 登录成功后调（SemiLogin onSuccess 用） */
export function setSemiJwt(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEMI_JWT_KEY, token);
  listeners.forEach((l) => l());
}

/** 登出 / 过期时清（useAuth.logout 用） */
export function clearSemiJwt(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SEMI_JWT_KEY);
  listeners.forEach((l) => l());
}

/** useSyncExternalStore subscribe — 同 tab 内通过 listeners，跨 tab 通过 storage event */
export function subscribeSemiJwt(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SEMI_JWT_KEY) cb();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    listeners.delete(cb);
  };
}
