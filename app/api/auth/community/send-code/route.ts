import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { sendSemiCode, checkSemiRegistered, SEMI_NOT_REGISTERED } from "@/src/lib/auth/semi-client";

/**
 * POST /api/auth/community/send-code
 * 转发短信验证码请求到 Semi API。无需登录（登录前的第一步）。
 *
 * P10-B P2-1：该端点每次调用花真钱（短信）。middleware 只按 IP 限流且 fail-open，
 * 换 IP 即可绕过 → 短信轰炸。这里补：
 *   ① E.164 手机号格式校验
 *   ② 按手机号维度独立限流（3 次/号/10 分钟）
 *   ③ fail-CLOSED —— Upstash 未配置/调用失败宁可拒发也不裸奔（与全站 fail-open 相反）
 */

const E164 = /^\+?[1-9]\d{6,14}$/;

// 按手机号限流器（模块级单例）。未配置 Upstash → null，POST 里 fail-closed 拒绝。
let phoneLimiter: Ratelimit | null = null;
try {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']+|["']+$/g, "").trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']+|["']+$/g, "").trim();
  if (url && token) {
    phoneLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      analytics: true,
      prefix: "sms-phone",
    });
  } else {
    console.warn("[send-code] UPSTASH 未配置 → 短信端点将 fail-closed 拒绝");
  }
} catch (err) {
  console.error("[send-code] Upstash 初始化失败 → fail-closed:", err instanceof Error ? err.message : err);
  phoneLimiter = null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = (body.phone as string | undefined)?.trim();

    if (!phone || !E164.test(phone)) {
      return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
    }

    // 未注册（或没在 Semi App 建钱包）不发码，引导先注册；查询失败(null)放行，验证阶段兜底
    const registered = await checkSemiRegistered(phone);
    if (registered === false) {
      return NextResponse.json(
        { error: "该手机号尚未注册 Semi 钱包", code: SEMI_NOT_REGISTERED },
        { status: 403 },
      );
    }

    // fail-closed：短信花真钱，限流不可用宁可拒发也不裸奔
    if (!phoneLimiter) {
      return NextResponse.json({ error: "服务暂不可用，请稍后重试" }, { status: 503 });
    }
    try {
      const { success } = await phoneLimiter.limit(phone);
      if (!success) {
        return NextResponse.json(
          { error: "验证码请求过于频繁，请 10 分钟后再试" },
          { status: 429 },
        );
      }
    } catch (err) {
      console.error("[send-code] 限流调用失败 → fail-closed 拒绝:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "服务暂不可用，请稍后重试" }, { status: 503 });
    }

    await sendSemiCode(phone);
    return NextResponse.json({ result: "ok" });
  } catch (err) {
    console.error("POST /api/auth/community/send-code error:", err);
    return NextResponse.json(
      { error: "发送验证码失败，请稍后重试" },
      { status: 502 },
    );
  }
}
