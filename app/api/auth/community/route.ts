import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifySemiCode, getSemiUser } from "@/src/lib/auth/semi-client";
import { supabaseAdmin } from "@/src/lib/supabase";
import { signJwt } from "@/src/lib/auth/jwt";

/**
 * POST /api/auth/community
 * Semi 社区钱包登录：验证码 → 拿 Semi 用户 → 查/建本站用户 → 签发 JWT
 *
 * 合并规则：evm_address 相同 → 同一个 user_id（Privy/Semi 共存）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = body.phone as string | undefined;
    const code = body.code as string | undefined;

    if (!phone || !code) {
      return NextResponse.json(
        { error: "缺少 phone 或 code" },
        { status: 400 },
      );
    }

    // 1. Semi 验证码登录 → auth_token
    const authToken = await verifySemiCode(phone.trim(), code.trim());

    // 2. 用 auth_token 拿 Semi 用户信息
    const semiUser = await getSemiUser(authToken);

    // 3. 查 auth_identities 是否已有此 Semi 用户
    const { data: existing } = await supabaseAdmin
      .from("auth_identities")
      .select("user_id")
      .eq("provider", "semi")
      .eq("provider_user_id", semiUser.semiUserId)
      .maybeSingle();

    let userId: string;
    let evmAddress: string;

    if (existing) {
      // 已注册过，直接取用户信息
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, evm_address")
        .eq("id", existing.user_id)
        .single();
      if (!user) {
        return NextResponse.json(
          { error: "用户数据异常" },
          { status: 500 },
        );
      }
      userId = user.id;
      evmAddress = user.evm_address;
    } else {
      // 新 Semi 用户 — 按 evm_address 合并或新建
      const result = await findOrCreateUser(semiUser);
      userId = result.userId;
      evmAddress = result.evmAddress;
    }

    // 4. 签发自签 JWT
    const { token } = await signJwt({ userId, evmAddress });

    return NextResponse.json({
      token,
      user: { id: userId, evmAddress },
    });
  } catch (err) {
    console.error("POST /api/auth/community error:", err);

    // Semi 返回的验证码错误，友好提示
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Invalid Phone Or Code") || msg.includes("Code Expired")) {
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 },
    );
  }
}

/** 按 evm_address 合并已有用户，或新建用户 + auth_identity */
async function findOrCreateUser(semiUser: {
  semiUserId: string;
  evmAddress: string;
}): Promise<{ userId: string; evmAddress: string }> {
  const semiUserId = semiUser.semiUserId;
  // F2: 标准化地址，避免大小写不一致
  const evmAddress = getAddress(semiUser.evmAddress);

  // 查是否已有同 evm_address 的用户（可能是 Privy 来的）
  const { data: sameAddr } = await supabaseAdmin
    .from("users")
    .select("id, evm_address")
    .eq("evm_address", evmAddress)
    .maybeSingle();

  if (sameAddr) {
    // F3: 合并 — upsert 防并发重复
    await supabaseAdmin
      .from("auth_identities")
      .upsert(
        { user_id: sameAddr.id, provider: "semi", provider_user_id: semiUserId },
        { onConflict: "provider,provider_user_id" },
      );
    return { userId: sameAddr.id, evmAddress: sameAddr.evm_address };
  }

  // 全新用户
  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({ evm_address: evmAddress })
    .select("id")
    .single();

  if (error) {
    // evm_address unique 冲突 = 并发，重查
    if (error.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("users")
        .select("id, evm_address")
        .eq("evm_address", evmAddress)
        .maybeSingle();
      if (retry) {
        await supabaseAdmin
          .from("auth_identities")
          .upsert(
            { user_id: retry.id, provider: "semi", provider_user_id: semiUserId },
            { onConflict: "provider,provider_user_id" },
          );
        return { userId: retry.id, evmAddress: retry.evm_address };
      }
    }
    throw error;
  }

  // F3: upsert 防并发重复
  await supabaseAdmin
    .from("auth_identities")
    .upsert(
      { user_id: newUser.id, provider: "semi", provider_user_id: semiUserId },
      { onConflict: "provider,provider_user_id" },
    );

  return { userId: newUser.id, evmAddress };
}
