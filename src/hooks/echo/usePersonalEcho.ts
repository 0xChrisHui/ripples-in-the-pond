'use client';

// 首页只读取当前登录钱包的 Echo；匿名不请求，内存缓存按身份隔离。
// 换身份先返回 null，让旧 Echo 的播放及时停止。
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { fetchWithAuth } from '@/src/lib/fetch-with-auth';
import type { FeaturedEcho, PersonalEchoHomeResponse } from '@/src/types/featured-echo';

const echoCache = new Map<string, FeaturedEcho>();

export function usePersonalEcho(enabled: boolean): FeaturedEcho | null {
  const { authenticated, authSource, userId, evmAddress, getAccessToken } = useAuth();
  const key = authenticated && authSource && userId && evmAddress
    ? `${authSource}:${userId}:${evmAddress.toLowerCase()}` : null;
  const [snapshot, setSnapshot] = useState<{
    key: string | null;
    echo: FeaturedEcho | null;
  }>(() => ({ key, echo: enabled && key ? echoCache.get(key) ?? null : null }));
  const tokenRef = useRef(getAccessToken);
  useEffect(() => { tokenRef.current = getAccessToken; });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    if (!authenticated) echoCache.clear();
    if (!enabled || !key) {
      queueMicrotask(() => {
        if (!signal.aborted) setSnapshot({ key: null, echo: null });
      });
      return () => controller.abort();
    }
    const identityKey = key;

    function publish(echo: FeaturedEcho | null) {
      if (signal.aborted) return;
      const cached = echoCache.get(identityKey);
      const stableEcho = echo && cached?.identity === echo.identity ? cached : echo;
      if (stableEcho) echoCache.set(identityKey, stableEcho);
      else echoCache.delete(identityKey);
      setSnapshot((current) => (
        current.key === identityKey && current.echo?.identity === stableEcho?.identity
          ? current : { key: identityKey, echo: stableEcho }
      ));
    }

    // 等身份切换的 null 提交后再显示缓存，确保下游先停止旧播放。
    queueMicrotask(() => publish(echoCache.get(identityKey) ?? null));

    async function execute() {
      try {
        const token = await tokenRef.current();
        if (signal.aborted) return;
        if (!token) {
          publish(null);
          return;
        }
        const response = await fetchWithAuth('/api/me/pond-echo/home', {
          headers: { Authorization: `Bearer ${token}` },
          signal,
          cache: 'no-store',
        });
        if (signal.aborted) return;
        if (!response.ok) {
          console.info(`[pond] 个人 Pond Echo 查询失败，暂不展示 #36（状态码 ${response.status}）`);
          publish(null);
          return;
        }
        const body = await response.json() as PersonalEchoHomeResponse;
        publish(body.pending ? null : body.echo);
      } catch (error: unknown) {
        if (signal.aborted) return;
        console.info('[pond] 个人 Pond Echo 查询失败，暂不展示 #36：', error);
        publish(null);
      }
    }
    void execute();
    return () => controller.abort();
  }, [authenticated, enabled, key]);

  return enabled && key && snapshot.key === key ? snapshot.echo : null;
}
