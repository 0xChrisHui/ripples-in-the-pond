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

/** 标记错误：手机号未注册 Semi（或注册了但没在 Semi App 建钱包，evm 地址为空） */
export const SEMI_NOT_REGISTERED = "SEMI_NOT_REGISTERED";

/**
 * 登录前置检查：手机号是否已注册 Semi 且有钱包地址。
 * 💭 为什么发码前查：Semi /signin 会对任意号码自动建空用户，空用户没有 evm 地址，
 * 走到 /get_me 才发现登不进 — 提前查可以不浪费短信、即刻引导用户去注册。
 * @returns true=可登录 / false=未注册或没钱包 / null=查询失败（fail-open，验证阶段兜底）
 */
export async function checkSemiRegistered(phone: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/get_by_handle?handle=${encodeURIComponent(phone)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (text.includes("User Not Found")) return false;
      return null; // 其它错误当查询失败处理，不拦登录
    }
    const data = await res.json();
    return Boolean(data.evm_chain_address);
  } catch (err) {
    console.error("[semi-client] get_by_handle 查询失败（fail-open 放行）:", err instanceof Error ? err.message : err);
    return null;
  }
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

  if (!data.id) {
    throw new Error("Semi /get_me 缺少 id");
  }
  // 验证码对了但从未在 Semi App 建过钱包（signin 自动建的空用户）→ 引导注册
  if (!data.evm_chain_address) {
    throw new Error(SEMI_NOT_REGISTERED);
  }

  return {
    semiUserId: data.id as string,
    evmAddress: data.evm_chain_address as string,
    phone: data.phone as string,
  };
}
