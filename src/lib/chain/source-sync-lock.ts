import 'server-only';
import { Redis } from '@upstash/redis';
import { sourceSyncLockKey } from '@/src/features/source-index/source-policy';
import type { SourceIdentity } from './source-cursor';

const LEASE_MS = 120_000;
let redis: Redis | null | undefined;

function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/^["']+|["']+$/g, '').trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^["']+|["']+$/g, '').trim();
  if (!url || !token) throw new Error('source sync 缺少 Upstash 配置');
  redis = new Redis({ url, token });
  return redis;
}

export async function acquireSourceSyncLock(
  identity: SourceIdentity,
  owner: string,
): Promise<boolean> {
  const result = await getRedis().set(
    sourceSyncLockKey(identity.chainId, identity.contract),
    owner,
    { nx: true, px: LEASE_MS },
  );
  return result === 'OK';
}

export async function releaseSourceSyncLock(
  identity: SourceIdentity,
  owner: string,
): Promise<void> {
  const result = await getRedis().eval(
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
    [sourceSyncLockKey(identity.chainId, identity.contract)],
    [owner],
  );
  if (result !== 0 && result !== 1) throw new Error('source sync 解锁返回值无效');
}
