'use client';
import type { Hex } from 'viem';
const prefix='ripples:material:hash:v1:';
export type MaterialCacheIdentity={userId:string;environment:string;chainId:number;contractAddress:string;recipientAddress:string;orderId:Hex};
function key(identity:MaterialCacheIdentity) {
  return prefix+encodeURIComponent(JSON.stringify([identity.userId,identity.environment,identity.chainId,
    identity.contractAddress.toLowerCase(),identity.recipientAddress.toLowerCase(),identity.orderId]));
}
export function rememberMaterialHash(identity:MaterialCacheIdentity,hash:Hex) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('交易hash无效');
  localStorage.setItem(key(identity),hash.toLowerCase());
}
export function readMaterialHash(identity:MaterialCacheIdentity):Hex|null {
  try { const hash=localStorage.getItem(key(identity)); return hash && /^0x[0-9a-f]{64}$/.test(hash)?hash as Hex:null; }
  catch { console.warn('原曲恢复缓存不可读，可从钱包复制已有交易hash恢复'); return null; }
}
export function forgetMaterialHash(identity:MaterialCacheIdentity) {
  try { localStorage.removeItem(key(identity)); }
  catch { console.warn('原曲交易已登记，但本地旧缓存暂不能移除'); }
}
