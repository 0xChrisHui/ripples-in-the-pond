// Arweave 核心工具：多网关 fallback + Turbo SDK 上传
// 本文件不带 'server-only'，以便 scripts/ 在 tsx 下 import 同一份逻辑。
// Next.js 运行时请统一从 '@/lib/arweave' (index.ts) 引入——那里有 server-only 守护。

import { readFileSync } from 'node:fs';
import {
  TurboFactory,
  type TurboAuthenticatedClient,
  type TokenType,
} from '@ardrive/turbo-sdk';

// 多网关 fallback 列表，顺序即优先级
// 只保留两个经过本机 curl 探测确认可达 + Arweave 生态公认主力的网关：
// - arweave.net       Arweave 官方主网关
// - ario.permagate.io AR.IO 社区运营的第二大网关
// Phase 3 S0 硬门槛：本机 verify-arweave-cors.ts 作 smoke test，
// 真正的"全球可达"验证延后到 S6 真部署 decoder 后浏览器跨设备手测。
// 注：早期版本列的 ar-io.dev / arweave.dev / gateway.irys.xyz 是错列/被 ESET 拦。
export const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ario.permagate.io',
] as const;

export type ArweaveGateway = (typeof ARWEAVE_GATEWAYS)[number];

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;

/**
 * 把 Arweave txId 拼成可访问的 HTTPS URL。
 * @param txId Arweave 交易 ID（43 位 base64url 字符）
 * @param gateway 可选网关，默认取主网关
 */
export function resolveArUrl(
  txId: string,
  gateway: ArweaveGateway = ARWEAVE_GATEWAYS[0],
): string {
  if (!TX_ID_RE.test(txId)) {
    throw new Error(`Invalid Arweave txId: ${txId}`);
  }
  return `${gateway}/${txId}`;
}

/**
 * 从 Arweave 下载文件——依次尝试所有网关，任何一个成功即返回。
 * 所有网关都失败时抛错，把每个网关的失败原因拼在一起便于排查。
 */
export async function fetchFromArweave(txId: string): Promise<Buffer> {
  if (!TX_ID_RE.test(txId)) {
    throw new Error(`Invalid Arweave txId: ${txId}`);
  }
  const errors: string[] = [];
  for (const gw of ARWEAVE_GATEWAYS) {
    try {
      const res = await fetch(`${gw}/${txId}`);
      if (!res.ok) {
        errors.push(`${gw}: HTTP ${res.status}`);
        continue;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      errors.push(`${gw}: ${(e as Error).message}`);
    }
  }
  throw new Error(
    `All Arweave gateways failed for ${txId}:\n${errors.join('\n')}`,
  );
}

export type UploadResult = { txId: string; url: string };

type WalletFile = {
  address: string;
  privateKey: string;
  token: TokenType;
};

let cachedClient: TurboAuthenticatedClient | null = null;

/**
 * 懒加载 Turbo 客户端。两种读取方式（优先级从高到低）：
 * 1. TURBO_WALLET_JWK 环境变量（JSON 字符串，Vercel 部署用）
 * 2. TURBO_WALLET_PATH 文件路径（本地开发兼容）
 */
function getTurboClient(): TurboAuthenticatedClient {
  if (cachedClient) return cachedClient;

  let wallet: WalletFile;
  const jwkEnv = process.env.TURBO_WALLET_JWK;
  if (jwkEnv) {
    wallet = JSON.parse(jwkEnv) as WalletFile;
  } else {
    const path = process.env.TURBO_WALLET_PATH;
    if (!path) {
      throw new Error(
        'TURBO_WALLET_JWK 或 TURBO_WALLET_PATH 需至少配一个',
      );
    }
    wallet = JSON.parse(readFileSync(path, 'utf-8')) as WalletFile;
  }

  cachedClient = TurboFactory.authenticated({
    privateKey: wallet.privateKey,
    token: wallet.token,
  });
  return cachedClient;
}

/**
 * 把 buffer 上传到 Arweave，返回 { txId, url }。
 * 内部走 Turbo SDK 签名 + 上传，credits 从 TURBO_WALLET_PATH 指向的钱包扣。
 */
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const client = getTurboClient();
  const result = await client.upload({
    data: buffer,
    dataItemOpts: {
      tags: [{ name: 'Content-Type', value: contentType }],
    },
  });
  return {
    txId: result.id,
    url: resolveArUrl(result.id),
  };
}
