import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cron 端点统一鉴权：
 * 1. 优先读 Authorization: Bearer xxx（Vercel / cron-job.org 推荐方式）
 * 2. 降级读 ?secret=xxx —— 仅非生产环境（本地/preview 调试），生产禁用（P10-B P3-2）
 *
 * P10-B P3-2：比较用常量时间（先各自 SHA-256 再 timingSafeEqual，规避长度泄露与
 * `===` 的短路时序侧信道）。cron 路由为 nodejs runtime，可直接用 node:crypto。
 */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function verifyCronSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // 路径 1：Authorization header（生产唯一路径）
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return safeEqual(authHeader.slice(7), expected);
  }

  // 路径 2：query param —— 生产禁用，只在本地/preview 兼容调试
  if (process.env.VERCEL_ENV === "production") return false;
  const secret = new URL(req.url).searchParams.get("secret");
  return secret != null && safeEqual(secret, expected);
}
