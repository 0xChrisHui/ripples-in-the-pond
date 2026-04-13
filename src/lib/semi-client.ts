import "server-only";

/**
 * Semi Wallet API 客户端
 * 只在后端使用，前端通过 /api/auth/community 间接调用
 *
 * Semi API 三步流程：
 *   1. POST /send_sms   — 发送验证码短信
 *   2. POST /signin      — 手机号 + 验证码 → auth_token
 *   3. GET  /get_me       — auth_token → 用户信息（含 EVM 地址）
 */

const TIMEOUT_MS = 5_000;

function getBaseUrl(): string {
  const url = process.env.SEMI_API_URL;
  if (!url) throw new Error("SEMI_API_URL 未配置");
  // 去掉尾部斜杠
  return url.replace(/\/+$/, "");
}

/** Semi /get_me 返回的用户信息（只取我们需要的字段） */
export interface SemiUser {
  semiUserId: string;
  evmAddress: string;
  phone: string;
}

/** 发送短信验证码 */
export async function sendSemiCode(phone: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/send_sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Semi /send_sms 失败 (${res.status}): ${text}`);
  }
}

/** 验证码登录，返回 auth_token */
export async function verifySemiCode(
  phone: string,
  code: string,
): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Semi /signin 失败 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const authToken = data.auth_token;
  if (!authToken) {
    throw new Error("Semi /signin 未返回 auth_token");
  }
  return authToken as string;
}

/** 用 auth_token 获取用户信息 */
export async function getSemiUser(authToken: string): Promise<SemiUser> {
  const res = await fetch(`${getBaseUrl()}/get_me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${authToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Semi /get_me 失败 (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!data.id || !data.evm_chain_address) {
    throw new Error("Semi /get_me 缺少 id 或 evm_chain_address");
  }

  return {
    semiUserId: data.id as string,
    evmAddress: data.evm_chain_address as string,
    phone: data.phone as string,
  };
}
