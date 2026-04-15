import { NextRequest, NextResponse } from "next/server";
import { sendSemiCode } from "@/src/lib/auth/semi-client";

/**
 * POST /api/auth/community/send-code
 * 转发短信验证码请求到 Semi API
 * 无需登录（登录前的第一步）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = body.phone as string | undefined;

    if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
      return NextResponse.json(
        { error: "请输入有效的手机号" },
        { status: 400 },
      );
    }

    await sendSemiCode(phone.trim());
    return NextResponse.json({ result: "ok" });
  } catch (err) {
    console.error("POST /api/auth/community/send-code error:", err);
    return NextResponse.json(
      { error: "发送验证码失败，请稍后重试" },
      { status: 502 },
    );
  }
}
