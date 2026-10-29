import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { RecipeV1 } from '@/src/types/wallet-recipe';

/**
 * 仅开发环境的假 #36：给本地目验视觉用（第36圆变淡、漂流、日食），不碰登录、不碰数据库。
 * 生产构建恒返回 null；URL 带 `?fakeEcho=1` 才启用。clips 为空，所以点它播放不会出声（只验视觉）。
 */
export function readDevFakeEcho(search: string): FeaturedEcho | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (new URLSearchParams(search).get('fakeEcho') !== '1') return null;
  const identity = 'eip155:1:0x0000000000000000000000000000000000000000:1' as const;
  return {
    kind: 'pond-echo', chainId: 1, contractAddress: '0x0000000000000000000000000000000000000000', tokenId: '1',
    identity, playbackId: `pond-echo:${identity}`, title: 'DEV fake Echo', href: '/echo/1',
    recipe: '' as RecipeV1, clips: {}, durationMs: 0,
  };
}
