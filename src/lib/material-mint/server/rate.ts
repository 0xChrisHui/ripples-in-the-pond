import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { MaterialError } from './policy';
const limiters = new Map<string, Ratelimit>();
export async function materialRate(userId: string, action: 'prepare' | 'authorization' | 'transition' | 'read') {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new MaterialError('恢复服务限流配置尚未就绪', 'RATE_SERVICE_UNAVAILABLE', 503);
  const counts = { prepare: 10, authorization: 20, transition: 30, read: 60 };
  let limiter = limiters.get(action);
  if (!limiter) {
    limiter = new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(counts[action], '1 m'),
      prefix: `material:${process.env.VERCEL_ENV ?? 'local'}:${action}`, analytics: false });
    limiters.set(action, limiter);
  }
  const result = await limiter.limit(userId);
  if (!result.success) throw new MaterialError('请求过于频繁，请稍后重试', 'RATE_LIMITED', 429);
}
