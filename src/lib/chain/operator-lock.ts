import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * Phase 6 A0 — 运营钱包全局串行锁
 * A16 — TTL 120s + Lua 心跳续期 + 生产 fail-closed
 *
 * LEASE_MS 从 30s 升至 120s：setTokenURI 在 OP Sepolia gas spike 时 receipt
 * 等待可能超 30s，原 30s TTL 会导致锁过期后第二个 cron 拿到锁 → nonce race。
 *
 * 心跳续期（heartbeatOpLock）用 Lua 脚本保证只对自己持有的锁续期：
 *   if GET(key) == holder then PEXPIRE(key, ms) else return 0
 *
 * fail-closed：生产环境无 Upstash 时一律拒绝（return false），
 * 防止测试/staging 配置漏配时误以为拿到锁。
 */

const LOCK_KEY = 'op_wallet_lock';
export const LEASE_MS = 120_000;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({
    url: url.replace(/^["']+|["']+$/g, '').trim(),
    token: token.replace(/^["']+|["']+$/g, '').trim(),
  });
  return redis;
}

export async function acquireOpLock(holder: string): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[op-lock] Upstash 未配置，生产环境 fail-closed，拒绝加锁');
      return false;
    }
    console.warn('[op-lock] Upstash 未配置，本地开发 fail-open（跳过锁）');
    return true;
  }
  const result = await r.set(LOCK_KEY, holder, { nx: true, px: LEASE_MS });
  return result === 'OK';
}

export async function releaseOpLock(holder: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      [LOCK_KEY],
      [holder],
    );
  } catch (err) {
    console.error('[op-lock] release failed (lease 可能已过期，无副作用):', err);
  }
}

/**
 * A16 — 心跳续期：仅对自己的锁续期（Lua 脚本校验 holder，防误续他人锁）。
 * 长步骤（writeContract / getTransactionReceipt）期间每 30s 调一次。
 * 返回 true = 续期成功；false = 锁已被他人持有（应终止当前步骤）。
 */
export async function heartbeatOpLock(holder: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // 本地开发 fail-open
  try {
    const result = await r.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end',
      [LOCK_KEY],
      [holder, String(LEASE_MS)],
    );
    return result === 1;
  } catch (err) {
    console.error('[op-lock] heartbeat failed:', err);
    return false;
  }
}

/** A16: /api/health 用于暴露锁提供方（upstash = 正常；fallback = Upstash 未配置） */
export function getLockProvider(): 'upstash' | 'fallback' {
  return getRedis() ? 'upstash' : 'fallback';
}
