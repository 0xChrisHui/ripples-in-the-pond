import type {
  RecipeV1,
  WalletRecipeMetadataClipV1,
} from './wallet-recipe';

/** 首页第 36 首引用已验证上链的 Pond Echo，不伪装成普通 Track。 */
export type FeaturedEcho = {
  kind: 'pond-echo';
  chainId: number;
  contractAddress: string;
  tokenId: string;
  identity: `eip155:${number}:${string}:${string}`;
  playbackId: `pond-echo:eip155:${number}:${string}:${string}`;
  title: string;
  href: `/echo/${string}`;
  recipe: RecipeV1;
  clips: Record<string, WalletRecipeMetadataClipV1>;
  durationMs: number;
};

export type FeaturedEchoResponse = {
  echo: FeaturedEcho | null;
};

export type PersonalEchoHomeResponse = {
  echo: FeaturedEcho | null;
  pending: boolean;
};
