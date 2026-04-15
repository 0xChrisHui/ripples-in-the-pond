import "server-only";

/**
 * Cron 端点统一鉴权：
 * 1. 优先读 Authorization: Bearer xxx（Vercel / cron-job.org 推荐方式）
 * 2. 降级读 ?secret=xxx（本地调试兼容）
 */
export function verifyCronSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // 路径 1：Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) === expected;
  }

  // 路径 2：query param（本地调试用）
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  return secret === expected;
}
