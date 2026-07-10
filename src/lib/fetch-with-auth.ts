import { clearSemiJwt } from '@/src/lib/auth/client-jwt';

/**
 * 带 401 统一登出的 fetch 包装（P10-C C-now「401 自动 logout」）。
 *
 * 用法：把带 `Authorization: Bearer <jwt>` 的 caller 里的 `fetch(...)` 换成
 * `fetchWithAuth(...)`，其余参数照旧。响应 401（JWT 过期 / 被拉入黑名单）时统一
 * 调 clearSemiJwt() —— 清 localStorage JWT + 通过 storage event 广播，useAuth 的
 * useSyncExternalStore 订阅者自动切到登出态，替代各 caller 自行 catch 401。
 *
 * 仅客户端调用（clearSemiJwt 依赖 window）。返回原始 Response，caller 照常处理。
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    clearSemiJwt();
  }
  return res;
}
