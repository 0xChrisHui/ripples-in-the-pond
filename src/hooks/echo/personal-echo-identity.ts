import type { FeaturedEcho } from '@/src/types/featured-echo';

type PersonalEchoAuth = {
  authenticated: boolean;
  authSource: string | null;
  userId: string | null;
  evmAddress: string | null;
};
type PersonalEchoSnapshot = { key: string | null; echo: FeaturedEcho | null };

/** 地址大小写不构成新身份；登录来源与用户也必须参与缓存隔离。 */
export function identityKeyOf({ authenticated, authSource, userId, evmAddress }: PersonalEchoAuth) {
  return authenticated && authSource && userId && evmAddress
    ? `${authSource}:${userId}:${evmAddress.toLowerCase()}` : null;
}

/** 渲染时先挡住旧快照，不等待身份切换后的 effect 才停止旧 Echo。 */
export function visibleEcho(enabled: boolean, key: string | null, snapshot: PersonalEchoSnapshot) {
  return enabled && key && snapshot.key === key ? snapshot.echo : null;
}

/** 仅在内存中按登录身份缓存；同一 Echo identity 保留原对象引用。 */
export function createPersonalEchoCache() {
  const entries = new Map<string, FeaturedEcho>();
  const forget = (key: string) => { entries.delete(key); };
  const clear = () => { entries.clear(); };
  return {
    get: (key: string) => entries.get(key) ?? null,
    remember(key: string, echo: FeaturedEcho | null): FeaturedEcho | null {
      if (!echo) { forget(key); return null; }
      const cached = entries.get(key);
      const stableEcho = cached?.identity === echo.identity ? cached : echo;
      entries.set(key, stableEcho);
      return stableEcho;
    },
    forget,
    clear,
    syncAuthentication(authenticated: boolean) {
      if (!authenticated) clear();
    },
  };
}
