import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

/** 与生产cron/部署共用同一个Redis键；真实留存绝不使用本地fail-open。 */
export async function acquireExecutionLease(planHash: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw Error('真实执行缺少共享运营锁配置，禁止fallback');
  const redis = new Redis({ url, token }), holder = `p17-archive:${planHash}:${randomUUID()}`;
  const key = 'op_wallet_lock';
  if (await redis.set(key, holder, { nx: true, px: 120000 }) !== 'OK') throw Error('共享运营锁正被其他执行持有');
  let valid = true;
  const refresh = async () => {
    const value = await redis.eval('if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE",KEYS[1],120000) else return 0 end',
      [key], [holder]);
    if (value !== 1) valid = false;
  };
  const timer = setInterval(() => { void refresh().catch(() => { valid = false; }); }, 30000);
  return {
    async assertLease() { if (!valid) throw Error('共享发送租约失效'); await refresh(); if (!valid) throw Error('共享发送租约失效'); },
    async release() {
      clearInterval(timer);
      await redis.eval('if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end', [key], [holder]);
    },
  };
}
