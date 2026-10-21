/** 将已验证的任意 Pond Echo 映射为首页只读 DTO，不携带 owner / originWallet。 */
import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { EchoViewData } from './types';

export function toFeaturedEcho(echo: EchoViewData, chainId: number): FeaturedEcho {
  if (!/^[1-9][0-9]*$/.test(echo.tokenId)) throw new Error('Pond Echo 编号必须是正整数十进制字符串');
  const normalizedContract = echo.contractAddress.toLowerCase();
  const identity = `eip155:${chainId}:${normalizedContract}:${echo.tokenId}` as const;
  return {
    kind: 'pond-echo', chainId, contractAddress: normalizedContract, tokenId: echo.tokenId, identity,
    playbackId: `pond-echo:${identity}`,
    title: echo.metadata.name,
    href: `/echo/${echo.tokenId}`,
    recipe: echo.metadata.properties.recipe,
    clips: echo.metadata.properties.clips,
    durationMs: echo.metadata.properties.durationMs,
  };
}
