import "server-only";

import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "../supabase";
import { verifyJwt } from "./jwt";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export interface AuthResult {
  userId: string;
  evmAddress: string;
}

/**
 * 统一认证中间件 — 先试 Privy，失败再试自签 JWT
 * 返回 { userId, evmAddress } 或 null
 */
export async function authenticateRequest(
  req: Request,
): Promise<AuthResult | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  // 路径 1：Privy token
  const privyResult = await tryPrivy(token);
  if (privyResult) return privyResult;

  // 路径 2：自签 JWT
  const jwtPayload = await verifyJwt(token);
  if (jwtPayload) {
    return { userId: jwtPayload.sub, evmAddress: jwtPayload.evm };
  }

  return null;
}

/** Privy 验证 → 查 auth_identities → 查/建用户 */
async function tryPrivy(token: string): Promise<AuthResult | null> {
  let privyUserId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    privyUserId = claims.userId;
  } catch {
    return null; // 不是有效的 Privy token
  }

  // 先查 auth_identities
  const { data: identity } = await supabaseAdmin
    .from("auth_identities")
    .select("user_id")
    .eq("provider", "privy")
    .eq("provider_user_id", privyUserId)
    .maybeSingle();

  if (identity) {
    return userById(identity.user_id);
  }

  // 向后兼容：旧用户可能还没迁移到 auth_identities
  // 也处理迁移脚本执行前就登录的新用户
  return findOrCreatePrivyUser(privyUserId);
}

/** 通过 privy_user_id 查/建用户，同时补 auth_identities 记录 */
async function findOrCreatePrivyUser(
  privyUserId: string,
): Promise<AuthResult | null> {
  // 先查 users 表（旧字段）
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, evm_address")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (existing) {
    // 补一条 auth_identities 记录（幂等）
    await supabaseAdmin
      .from("auth_identities")
      .upsert(
        { user_id: existing.id, provider: "privy", provider_user_id: privyUserId },
        { onConflict: "provider,provider_user_id" },
      );
    return { userId: existing.id, evmAddress: existing.evm_address };
  }

  // 全新 Privy 用户 — 从 Privy 拿钱包地址并创建
  const privyUser = await privy.getUser(privyUserId);
  const wallet = privyUser.wallet;
  if (!wallet) return null;

  const evmAddress = wallet.address;

  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({ evm_address: evmAddress, privy_user_id: privyUserId })
    .select("id")
    .single();

  if (error) {
    // unique 冲突 = 并发创建，重新查
    if (error.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("users")
        .select("id, evm_address")
        .eq("privy_user_id", privyUserId)
        .maybeSingle();
      if (retry) {
        await supabaseAdmin
          .from("auth_identities")
          .upsert(
            { user_id: retry.id, provider: "privy", provider_user_id: privyUserId },
            { onConflict: "provider,provider_user_id" },
          );
        return { userId: retry.id, evmAddress: retry.evm_address };
      }
    }
    console.error("创建 Privy 用户失败:", error);
    return null;
  }

  // 写 auth_identities
  await supabaseAdmin
    .from("auth_identities")
    .insert({ user_id: newUser.id, provider: "privy", provider_user_id: privyUserId });

  return { userId: newUser.id, evmAddress };
}

async function userById(userId: string): Promise<AuthResult | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, evm_address")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return { userId: data.id, evmAddress: data.evm_address };
}
