import type { PermanentMediaHealthContract } from './types';

const LEGACY_STORAGE_KEY = 'ripples:media-mirror-health:v1';
let legacyStateCleared = false;

/** 清除旧版跨刷新镜像冷却；Storage 不可用时保持可重试。 */
export function clearLegacyMirrorHealthState(): void {
  if (legacyStateCleared) return;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    storage.removeItem(LEGACY_STORAGE_KEY);
    legacyStateCleared = true;
  } catch {
    // 隐私模式或沙箱可能拒绝 Storage，解析热路径不得因此失败。
  }
}

type HealthOptions = Readonly<{
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}>;

type CandidateState = {
  failures: number;
  coolingUntil: number;
};

/** 只记录公开候选基址的短期健康，不持久化用户或资源标识。 */
export class PermanentMediaHealth implements PermanentMediaHealthContract {
  private readonly states = new Map<string, CandidateState>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: HealthOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 2);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 30_000);
    this.now = options.now ?? Date.now;
  }

  canAttempt(key: string): boolean {
    const state = this.states.get(key);
    if (!state) return true;
    if (state.coolingUntil <= this.now()) {
      if (state.coolingUntil > 0) this.states.delete(key);
      return true;
    }
    return false;
  }

  recordFailure(key: string): void {
    const state = this.states.get(key) ?? { failures: 0, coolingUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.failureThreshold) {
      state.failures = 0;
      state.coolingUntil = this.now() + this.cooldownMs;
    }
    this.states.set(key, state);
  }

  recordSuccess(key: string): void {
    this.states.delete(key);
  }

  reset(): void {
    this.states.clear();
  }
}

export const sharedPermanentMediaHealth = new PermanentMediaHealth();
