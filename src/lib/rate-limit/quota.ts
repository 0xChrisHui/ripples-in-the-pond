import { Redis } from '@upstash/redis';

const TAKE = `local n = tonumber(redis.call('GET',KEYS[1]) or '0')
if n >= tonumber(ARGV[1]) then return 0 end
redis.call('INCR',KEYS[1])
redis.call('EXPIRE',KEYS[1],ARGV[2])
return 1`;
const REFUND = "if tonumber(redis.call('GET',KEYS[1]) or '0') > 0 then return redis.call('DECR',KEYS[1]) end return 0";

export function positiveLimit(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && raw?.trim() ? value : fallback;
}
export async function takeQuota(name: string, max: number, windowSeconds: number, failOpen: boolean, now = Date.now()) {
  const tick = Math.floor(now / 1000);
  const period = Math.floor(tick / windowSeconds);
  const retryAfter = windowSeconds - tick % windowSeconds;
  const key = ['quota', process.env.VERCEL_ENV ?? 'local', name, period].join(':');
  const receipt = { allowed: false, unavailable: false, retryAfter, refund: undefined as (() => Promise<void>) | undefined };
  try {
    const redis = Redis.fromEnv();
    receipt.allowed = (await redis.eval(TAKE, [key], [max, retryAfter + 1])) === 1;
    if (receipt.allowed) receipt.refund = async () => {
      try { await redis.eval(REFUND, [key], []); }
      catch { console.error('[quota] 额度退回失败'); }
    };
  } catch {
    console.error('[quota] 限额服务不可用', name.split(':')[0]);
    receipt.allowed = failOpen;
    receipt.unavailable = true;
  }
  return receipt;
}
