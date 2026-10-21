import type { Track } from '@/src/types/tracks';
import type { FeaturedEcho } from '@/src/types/featured-echo';
import type { RecipeV1 } from '@/src/types/wallet-recipe';
import type { ProjCtx } from '@/src/components/pond-gl-test3/sphere-projection';

export const tracks: Track[] = Array.from({ length: 35 }, (_, i) => ({
  id: `track-${i + 1}`, title: `测试曲目 ${i + 1}`, week: i + 1,
  audio_url: `/tracks/${i + 1}.mp3`, arweave_url: null, audio_gateway_urls: [],
  cover: '#446655', island: 'A', created_at: '2026-01-01', published: true,
}));
export const echo: FeaturedEcho = {
  kind: 'pond-echo', chainId: 10,
  contractAddress: '0x3333333333333333333333333333333333333333', tokenId: '1',
  identity: 'eip155:10:0x3333333333333333333333333333333333333333:1',
  playbackId: 'pond-echo:eip155:10:0x3333333333333333333333333333333333333333:1',
  title: '测试 Echo', href: '/echo/1', recipe: 'A'.repeat(36) as RecipeV1,
  clips: { A: { uri: `ar://${'A'.repeat(43)}`, sha256: 'b'.repeat(64), durationMs: 7050 } },
  durationMs: 253800,
};
export const otherEcho: FeaturedEcho = {
  ...echo, tokenId: '2', identity: `${echo.identity}-B`, playbackId: `${echo.playbackId}-B`, href: '/echo/2',
};
export const projection: ProjCtx = {
  cx: 600, cy: 400, mx: 0, my: 0, focusZ: 0.5,
  dof: true, perspective: true, parallax: true,
};
