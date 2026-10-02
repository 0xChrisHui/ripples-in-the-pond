'use client';
import { useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { fetchWithAuth } from '../../../lib/fetch-with-auth';
import { createMaterialMintClient, type MaterialRequest } from './order-client';
import type { Hex } from 'viem';

export function useMaterialMint() {
  const { userId, selectedExternalWallet, walletCapability, getAccessToken } = useAuth();
  const request = useCallback<MaterialRequest>(async (path, method, body) => {
    const token = await getAccessToken(); if (!token) throw Error('请先登录');
    const response = await fetchWithAuth(`/api/material-mint/${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store',
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result: unknown = await response.json();
    if (!response.ok) throw Error(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error : '原曲订单请求失败');
    return result;
  }, [getAccessToken]);
  const kind = walletCapability.walletKind;
  // 原曲开关独立于Score，使用已验证external身份；服务端再次查linked钱包与原曲模式。
  const client = useCallback(() => createMaterialMintClient({ userId, request,
    wallet: kind === 'external' ? selectedExternalWallet : null }), [userId, request, kind, selectedExternalWallet]);
  const getOrder = useCallback((id: Hex) => client().getOrder(id), [client]);
  const listOrders = useCallback((trackId?: string) => client().listOrders(trackId), [client]);
  const prepareOrder = useCallback((trackId: string) => client().prepareOrder(trackId), [client]);
  const sendOrder = useCallback((id: Hex) => client().sendOrder(id), [client]);
  const recoverOrder = useCallback((id: Hex, hash?: Hex) => client().recoverOrder(id, hash), [client]);
  return { getOrder, listOrders, prepareOrder, sendOrder, recoverOrder };
}
