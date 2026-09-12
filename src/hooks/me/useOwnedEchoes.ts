'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyEchoes } from '@/src/data/echo/client';
import type { EchoArchiveItem, MyEchoesResponse } from '@/src/data/echo/types';
import {
  normalizeArchiveAddress,
  readArchiveCache,
  validCachedEcho,
  writeArchiveCache,
  type ArchiveAuthSource,
} from './archive-cache';
import type { ArchiveSlice } from './archive-state';

type EchoSlice = ArchiveSlice<EchoArchiveItem> & { warning: string | null };
const EMPTY: EchoSlice = {
  items: [], phase: 'idle', error: null, resolved: false, warning: null,
};
export const ECHO_CACHE_NOTICE = '正在显示上次链上确认，正后台核对当前持有人…';

function responseWarning(result: MyEchoesResponse): string | null {
  const warnings = [
    result.truncated ? `链上持有超过 ${result.echoes.length} 枚，仅显示前一部分` : null,
    result.originStatusUnavailable ? '来源状态暂不可用；当前持有列表仍以链上为准' : null,
  ].filter((value): value is string => Boolean(value));
  return warnings.join('；') || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '池中回声读取失败';
}

/** Echo 使用 owner+钱包+链+合约隔离的最后确认快照，并始终后台核对链上真值。 */
export function useOwnedEchoes(input: {
  authenticated: boolean;
  authSource: ArchiveAuthSource | null;
  userId: string | null | undefined;
  evmAddress: string | null;
  getAccessToken: () => Promise<string | null>;
}) {
  const [slice, setSlice] = useState<EchoSlice>(EMPTY);
  const [refresh, setRefresh] = useState(0);
  const tokenRef = useRef(input.getAccessToken);
  useEffect(() => { tokenRef.current = input.getAccessToken; });

  useEffect(() => {
    const address = normalizeArchiveAddress(input.evmAddress);
    const identity = input.authSource && input.userId && address
      ? { authSource: input.authSource, userId: input.userId, evmAddress: address }
      : null;
    const controller = new AbortController();
    if (!input.authenticated || !identity) {
      setSlice(EMPTY);
      return () => controller.abort();
    }
    const activeIdentity = identity;
    const cached = readArchiveCache(activeIdentity, 'echoes', validCachedEcho);
    setSlice(cached
      ? { items: cached.items, phase: 'refreshing', error: null,
        resolved: true, cached: true, warning: ECHO_CACHE_NOTICE }
      : { ...EMPTY, phase: 'loading' });

    async function execute() {
      try {
        const token = await tokenRef.current();
        if (controller.signal.aborted) return;
        if (!token) throw new Error('登录凭证暂不可用，请重新登录');
        const result = await fetchMyEchoes(token, controller.signal);
        if (controller.signal.aborted) return;
        writeArchiveCache(activeIdentity, 'echoes', '/api/me/pond-echoes', result.echoes);
        setSlice({ items: result.echoes, phase: 'ready', error: null,
          resolved: true, warning: responseWarning(result) });
      } catch (error) {
        if (controller.signal.aborted) return;
        setSlice((current) => ({ ...current, phase: 'error',
          error: current.cached
            ? `当前链上核对失败；以下为上次链上确认：${errorMessage(error)}`
            : errorMessage(error),
          warning: null }));
      }
    }
    void execute();
    return () => controller.abort();
  }, [input.authenticated, input.authSource, input.evmAddress, input.userId, refresh]);

  const retry = useCallback(() => setRefresh((value) => value + 1), []);
  return { ...slice, retry };
}
