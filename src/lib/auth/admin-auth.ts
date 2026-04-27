import 'server-only';

/**
 * Phase 6 D2 — 管理端点（airdrop trigger 等）的 Bearer-only 鉴权
 *
 * 不接受 query string token：query 会进浏览器历史 / 代理日志 /
 * 截图 / 复制链接 → 泄露面大。仿 cron-auth 但**严格 Bearer only**。
 */
export function verifyAdminToken(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === expected;
  }
  return false;
}
