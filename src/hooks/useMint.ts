'use client';

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

type MintStatus = 'idle' | 'minting' | 'success' | 'error';

/**
 * 铸造 hook — 调 POST /api/mint/material
 * 返回状态 + 触发函数
 */
export function useMint() {
  const { authenticated, getAccessToken } = useAuth();
  const [status, setStatus] = useState<MintStatus>('idle');

  const mint = useCallback(async (tokenId: number) => {
    if (!authenticated) return;
    setStatus('minting');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('无法获取 token');

      const res = await fetch('/api/mint/material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tokenId,
          idempotencyKey: `mint-${tokenId}-${Date.now()}`,
        }),
      });

      if (!res.ok) throw new Error('铸造请求失败');

      setStatus('success');
    } catch (err) {
      console.error('mint error:', err);
      setStatus('error');
    }
  }, [authenticated, getAccessToken]);

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, mint, reset };
}
