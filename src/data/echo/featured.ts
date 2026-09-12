import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { EchoViewData } from './types';

/** 将已验证的 ECHO #1 映射为首页只读 DTO；不携带 owner 或 Track 字段。 */
export function toFeaturedEcho(echo: EchoViewData, chainId: number): FeaturedEcho {
  if (echo.tokenId !== '1') throw new Error('首页第 36 首只接受 Pond Echo #1');
  const normalizedContract = echo.contractAddress.toLowerCase();
  const identity = `eip155:${chainId}:${normalizedContract}:${echo.tokenId}` as const;
  return {
    kind: 'pond-echo', chainId, contractAddress: normalizedContract, tokenId: '1', identity,
    playbackId: `pond-echo:${identity}`,
    title: echo.metadata.name,
    href: '/echo/1',
    recipe: echo.metadata.properties.recipe,
    clips: echo.metadata.properties.clips,
    durationMs: echo.metadata.properties.durationMs,
  };
}
