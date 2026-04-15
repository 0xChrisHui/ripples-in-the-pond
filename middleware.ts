import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * 全局中间件 — 对成本敏感的 API 端点做 IP 限流
 *
 * 限流范围（会消耗 Gas 或发短信的端点）：
 *   /api/mint/*        — 铸造 NFT
 *   /api/auth/*        — 登录 / 发短信验证码
 *   /api/score/save    — 保存乐谱草稿
 *   /api/airdrop/*     — 空投触发
 *
 * 不限流：
 *   /api/cron/*   — 已有 CRON_SECRET 保护
 *   /api/health   — 已有 CRON_SECRET 保护
 *   /api/ping     — 公开存活检查
 *   /api/tracks   — 公开只读
 *   /api/artist/* — 公开只读
 *   /api/sounds   — 公开只读
 *   /api/scores/* — 公开只读
 */

// 需要限流的路径前缀
const RATE_LIMITED_PREFIXES = [
  "/api/mint/",
  "/api/auth/",
  "/api/score/save",
  "/api/airdrop/",
];

function shouldRateLimit(pathname: string): boolean {
  return RATE_LIMITED_PREFIXES.some((p) => pathname.startsWith(p));
}

// Upstash 未配置或初始化失败时跳过限流（不阻塞其他 API）
let ratelimit: Ratelimit | null = null;
try {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']+|["']+$/g, "").trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']+|["']+$/g, "").trim();
  if (url && token) {
    const redis = new Redis({ url, token });
    ratelimit = new Ratelimit({
      redis,
      // sliding window：每 IP 每 10 秒 20 次请求
      limiter: Ratelimit.slidingWindow(20, "10 s"),
      analytics: true,
    });
  }
} catch {
  // 初始化失败 → fail open，不阻塞
  console.error("[middleware] Upstash 初始化失败，限流已禁用");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!shouldRateLimit(pathname)) {
    return NextResponse.next();
  }

  if (!ratelimit) {
    // Upstash 未配置 → fail open，不阻塞
    return NextResponse.next();
  }

  // 用 IP 作为限流 key
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  try {
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }

    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit", limit.toString());
    res.headers.set("X-RateLimit-Remaining", remaining.toString());
    return res;
  } catch {
    // Upstash 宕机 → fail open
    return NextResponse.next();
  }
}

export const config = {
  matcher: "/api/:path*",
};
