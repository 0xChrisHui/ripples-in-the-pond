'use client';

import { fetchWithAuth } from '@/src/lib/fetch-with-auth';
import type { MyEchoesResponse } from './types';

export async function fetchMyEchoes(token: string, signal?: AbortSignal): Promise<MyEchoesResponse> {
  const response = await fetchWithAuth('/api/me/pond-echoes', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? '登录状态已失效，请重新登录' : '池中回声读取失败');
  }
  return response.json() as Promise<MyEchoesResponse>;
}
