import "server-only";

import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { supabaseAdmin } from "../supabase";

const ALG = "RS256" as const;
const ISSUER = "ripples";
const EXPIRATION = "7d";

// 惰性缓存，避免构建期读不到环境变量就崩
let _privateKey: CryptoKey | null = null;
let _publicKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (!_privateKey) {
    const pem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!pem) throw new Error("JWT_PRIVATE_KEY 未配置");
    _privateKey = await importPKCS8(pem, ALG);
  }
  return _privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!_publicKey) {
    const pem = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
    if (!pem) throw new Error("JWT_PUBLIC_KEY 未配置");
    _publicKey = await importSPKI(pem, ALG);
  }
  return _publicKey;
}

/** JWT payload 类型 */
export interface JwtPayload {
  sub: string; // userId
  evm: string; // evmAddress
  iss: string; // "ripples"
  jti: string; // 唯一 ID，用于撤销
}

/**
 * 签发 JWT
 * @returns JWT 字符串 + jti（调用方可能需要 jti 做记录）
 */
export async function signJwt(payload: {
  userId: string;
  evmAddress: string;
}): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const key = await getPrivateKey();

  const token = await new SignJWT({
    evm: payload.evmAddress,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(key);

  return { token, jti };
}

/**
 * 验证 JWT — 签名 + 过期 + jti 不在黑名单
 * @returns payload 或 null（任何验证失败都返回 null）
 */
export async function verifyJwt(
  token: string,
): Promise<JwtPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
    });

    const jti = payload.jti;
    if (!jti) return null;

    // 检查黑名单
    const { data } = await supabaseAdmin
      .from("jwt_blacklist")
      .select("jti")
      .eq("jti", jti)
      .maybeSingle();

    if (data) return null; // 已撤销

    return {
      sub: payload.sub!,
      evm: payload.evm as string,
      iss: payload.iss!,
      jti,
    };
  } catch {
    // 签名无效 / 过期 / 格式错误
    return null;
  }
}

/**
 * 撤销 JWT — 把 jti 写入黑名单
 * expires_at 设为 7 天后（和 JWT 有效期一致，过期后自动可清理）
 */
export async function revokeJwt(jti: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  await supabaseAdmin.from("jwt_blacklist").upsert(
    { jti, expires_at: expiresAt },
    { onConflict: "jti" },
  );
}
