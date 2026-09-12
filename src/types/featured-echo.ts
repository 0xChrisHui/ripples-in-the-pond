import type {
  RecipeV1,
  WalletRecipeMetadataClipV1,
} from './wallet-recipe';

/** 首页第 36 首只引用已上链的 ECHO #1，不伪装成普通 Track。 */
export type FeaturedEcho = {
  kind: 'pond-echo';
  chainId: number;
  contractAddress: string;
  tokenId: '1';
  identity: `eip155:${number}:${string}:1`;
  playbackId: `pond-echo:eip155:${number}:${string}:1`;
  title: string;
  href: '/echo/1';
  recipe: RecipeV1;
  clips: Record<string, WalletRecipeMetadataClipV1>;
  durationMs: number;
};

export type FeaturedEchoResponse = {
  echo: FeaturedEcho | null;
};
