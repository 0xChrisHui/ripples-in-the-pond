'use client';

// 首页只读取当前登录钱包的 Echo；匿名不请求，内存缓存按身份隔离。
// 换身份先返回 null，让旧 Echo 的播放及时停止。
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchWithAuth } from '@/src/lib/fetch-with-auth';
import type { FeaturedEcho, PersonalEchoHomeResponse } from '@/src/types/featured-echo';
import { createPersonalEchoPoll } from '@/src/hooks/echo/personal-echo-poll';
import { createPersonalEchoCache, identityKeyOf, visibleEcho } from '@/src/hooks/echo/personal-echo-identity';

const echoCache = createPersonalEchoCache();

export function usePersonalEcho(enabled: boolean, active: boolean): FeaturedEcho | null {
  const { authenticated, authSource, userId, evmAddress, getAccessToken } = useAuth();
  const key = identityKeyOf({ authenticated, authSource, userId, evmAddress });
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    echo: FeaturedEcho | null;
  }>(() => ({ key, echo: enabled && key ? echoCache.get(key) ?? null : null }));
  const tokenRef = useRef(getAccessToken);
  const activeRef = useRef(active);
  const pollRef = useRef<ReturnType<typeof createPersonalEchoPoll> | null>(null);
  useEffect(() => { tokenRef.current = getAccessToken; });
  useEffect(() => {
    const becameVisible = active && !activeRef.current;
    activeRef.current = active;
    if (becameVisible) pollRef.current?.recheck();
  }, [active]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    echoCache.syncAuthentication(authenticated);
    if (!enabled || !key) {
      queueMicrotask(() => {
        if (!signal.aborted) setSnapshot({ key: null, echo: null });
      });
      return () => controller.abort();
    }
    const identityKey = key;

    function publish(echo: FeaturedEcho | null) {
      if (signal.aborted) return;
      const stableEcho = echoCache.remember(identityKey, echo);
      setSnapshot((current) => (
        current.key === identityKey && current.echo?.identity === stableEcho?.identity
          ? current : { key: identityKey, echo: stableEcho }
      ));
    }

    // 等身份切换的 null 提交后再显示缓存，确保下游先停止旧播放。
    queueMicrotask(() => publish(echoCache.get(identityKey) ?? null));

    const poll = createPersonalEchoPoll({
      async query(requestSignal) {
        const token = await tokenRef.current();
        requestSignal.throwIfAborted();
        if (!token) return { echo: null, pending: false };
        const response = await fetchWithAuth('/api/me/pond-echo/home', {
          headers: { Authorization: `Bearer ${token}` },
          signal: requestSignal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`个人 Pond Echo 查询失败（状态码 ${response.status}）`);
        }
        return await response.json() as PersonalEchoHomeResponse;
      },
      onEcho: publish,
      onError(error) {
        console.info('[pond] 个人 Pond Echo 查询失败，暂不展示 #36：', error);
      },
      isVisible: () => activeRef.current && document.visibilityState === 'visible',
      now: () => Date.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
      createAbortController: () => new AbortController(),
    });
    pollRef.current = poll;
    const recheck = () => poll.recheck();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', onVisibilityChange);
    poll.start();
    return () => {
      controller.abort();
      poll.stop();
      pollRef.current = null;
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authenticated, enabled, key]);

  return visibleEcho(enabled, key, snapshot);
}
