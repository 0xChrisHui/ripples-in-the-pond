import "server-only";

import { supabaseAdmin } from "../supabase";
import { verifyJwt } from "./jwt";
import { getPrivyUser, preferredEvmAddress, verifyPrivyAccessToken } from "./privy-server";

export interface AuthResult {
  userId: string;
  evmAddress: string;
  authSource: "privy" | "semi";
  privyUserId?: string;
}

type AuthUser = Pick<AuthResult, "userId" | "evmAddress">;

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
    return { userId: jwtPayload.sub, evmAddress: jwtPayload.evm, authSource: "semi" };
  }

  return null;
}

/** Privy 验证 → 查 auth_identities → 查/建用户 */
async function tryPrivy(token: string): Promise<AuthResult | null> {
  const privyUserId = await verifyPrivyAccessToken(token);
  if (!privyUserId) return null;

  // 先查 auth_identities
  const { data: identity } = await supabaseAdmin
    .from("auth_identities")
    .select("user_id")
    .eq("provider", "privy")
    .eq("provider_user_id", privyUserId)
    .maybeSingle();

  if (identity) {
    const user = await userById(identity.user_id);
    return user && { ...user, authSource: "privy", privyUserId };
  }

  // 向后兼容：旧用户可能还没迁移到 auth_identities
  // 也处理迁移脚本执行前就登录的新用户
  const user = await findOrCreatePrivyUser(privyUserId);
  return user && { ...user, authSource: "privy", privyUserId };
}

/** 通过 privy_user_id 查/建用户，同时补 auth_identities 记录 */
async function findOrCreatePrivyUser(
  privyUserId: string,
): Promise<AuthUser | null> {
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
  const evmAddress = preferredEvmAddress(await getPrivyUser(privyUserId));
  if (!evmAddress) return null;

  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({ evm_address: evmAddress, privy_user_id: privyUserId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // F1: 冲突可能是 privy_user_id 重复 或 evm_address 被 Semi 用户占了
      // 先按 privy_user_id 查
      const { data: byPrivy } = await supabaseAdmin
        .from("users")
        .select("id, evm_address")
        .eq("privy_user_id", privyUserId)
        .maybeSingle();
      if (byPrivy) {
        await supabaseAdmin
          .from("auth_identities")
          .upsert(
            { user_id: byPrivy.id, provider: "privy", provider_user_id: privyUserId },
            { onConflict: "provider,provider_user_id" },
          );
        return { userId: byPrivy.id, evmAddress: byPrivy.evm_address };
      }
      // 再按 evm_address 查（Semi 用户已存在同地址）→ 合并
      const { data: byAddr } = await supabaseAdmin
        .from("users")
        .select("id, evm_address")
        .eq("evm_address", evmAddress)
        .maybeSingle();
      if (byAddr) {
        await supabaseAdmin
          .from("auth_identities")
          .upsert(
            { user_id: byAddr.id, provider: "privy", provider_user_id: privyUserId },
            { onConflict: "provider,provider_user_id" },
          );
        return { userId: byAddr.id, evmAddress: byAddr.evm_address };
      }
    }
    console.error("创建 Privy 用户失败:", error);
    return null;
  }

  // F3: 写 auth_identities（upsert 防并发重复）
  await supabaseAdmin
    .from("auth_identities")
    .upsert(
      { user_id: newUser.id, provider: "privy", provider_user_id: privyUserId },
      { onConflict: "provider,provider_user_id" },
    );

  return { userId: newUser.id, evmAddress };
}

async function userById(userId: string): Promise<AuthUser | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, evm_address")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return { userId: data.id, evmAddress: data.evm_address };
}
