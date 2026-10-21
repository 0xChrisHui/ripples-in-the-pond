import assert from 'node:assert/strict';
import type { EchoViewData } from '../../src/data/echo/types';
import type { RecipeV1 } from '../../src/types/wallet-recipe';
import { createWalletRecipeTimeline } from '../../src/features/wallet-recipe/player/timeline';
import { loadWalletRecipeAudio } from '../../src/features/wallet-recipe/player/media-loader';
import { toFeaturedEcho } from '../../src/data/echo/featured';

const echo = {
  tokenId: '1',
  owner: '0x1111111111111111111111111111111111111111',
  originWallet: '0x2222222222222222222222222222222222222222',
  tokenUri: `ar://${'M'.repeat(43)}`,
  metadataTxId: 'M'.repeat(43),
  contractAddress: '0x3333333333333333333333333333333333333333',
  network: 'OP Mainnet',
  explorerUrl: 'https://example.invalid/address/0x3',
  imageUrl: `https://example.invalid/${'I'.repeat(43)}`,
  verifiedGateways: ['https://gateway-a.invalid', 'https://gateway-b.invalid'],
  metadata: {
    name: 'Pond Echo · 0x22—2222',
    description: '永久配方作品',
    image: `ar://${'I'.repeat(43)}`,
    animation_url: `ar://${'D'.repeat(43)}`,
    external_url: 'https://pond-ripple.xyz/echo/origin/0x2',
    attributes: [],
    properties: {
      recipeVersion: 1,
      recipe: 'A'.repeat(36) as RecipeV1,
      originWallet: '0x2222222222222222222222222222222222222222',
      sourceScoreTokenId: 1,
      clipManifest: `ar://${'C'.repeat(43)}`,
      clipManifestSha256: 'a'.repeat(64),
      durationMs: 251_940,
      clips: {
        A: {
          uri: `ar://${'A'.repeat(43)}`,
          sha256: 'b'.repeat(64),
          durationMs: 7_050,
        },
      },
    },
  },
} satisfies EchoViewData;

async function main() {
  process.env.NEXT_PUBLIC_CHAIN_ID ??= '10';
  // Vercel CLI 不会把 sensitive 变量下载到本地；live 只读验收复用同链的公开 RPC 配置。
  if (process.argv.includes('--live') && !process.env.ALCHEMY_RPC_URL) {
    process.env.ALCHEMY_RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  }
  for (const tokenId of ['1', '2']) {
    const featured = toFeaturedEcho({ ...echo, tokenId }, 10);
    assert.deepEqual(Object.keys(featured), [
      'kind', 'chainId', 'contractAddress', 'tokenId', 'identity', 'playbackId',
      'title', 'href', 'recipe', 'clips', 'durationMs',
    ]);
    assert.deepEqual(featured, {
      kind: 'pond-echo',
      chainId: 10,
      contractAddress: echo.contractAddress,
      tokenId,
      identity: `eip155:10:${echo.contractAddress}:${tokenId}`,
      playbackId: `pond-echo:eip155:10:${echo.contractAddress}:${tokenId}`,
      title: echo.metadata.name,
      href: `/echo/${tokenId}`,
      recipe: echo.metadata.properties.recipe,
      clips: echo.metadata.properties.clips,
      durationMs: echo.metadata.properties.durationMs,
    });
    for (const forbidden of ['owner', 'originWallet', 'audio_url', 'material_mintable']) {
      assert.equal(forbidden in featured, false, `DTO 不应包含 ${forbidden}`);
    }
  }
  for (const tokenId of ['0', 'abc']) {
    assert.throws(
      () => toFeaturedEcho({ ...echo, tokenId }, 10),
      /Pond Echo 编号必须是正整数十进制字符串/,
    );
  }
  console.log('Pond Echo 首页 DTO：#1/#2 映射、非法编号拒绝与字段边界通过');

  if (!process.argv.includes('--live')) return;
  // 联网只读验收：npx tsx --conditions=react-server scripts/p14/verify-featured-echo.ts --live --token=2
  const tokenId = process.argv.find((arg) => arg.startsWith('--token='))?.slice('--token='.length) ?? '1';
  assert.match(tokenId, /^[1-9][0-9]*$/, '--token 必须是正整数十进制字符串');
  const { getEchoByTokenId } = await import('../../src/data/echo/source');
  const liveView = await getEchoByTokenId(BigInt(tokenId));
  assert.ok(liveView, `当前链上尚未铸造 Pond Echo #${tokenId}`);
  const live = toFeaturedEcho(liveView, Number(process.env.NEXT_PUBLIC_CHAIN_ID));
  const timeline = createWalletRecipeTimeline({ recipe: live.recipe, clips: live.clips });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('Pond Echo clip Gate 总超时'), 360_000);
  let loaded = 0;
  try {
    const compressed = await loadWalletRecipeAudio(
      { recipe: live.recipe, clips: live.clips }, timeline.uniqueKeys, fetch, controller.signal,
      (count) => { loaded = count; },
    );
    assert.equal(compressed.size, timeline.uniqueKeys.length);
    assert.equal(loaded, timeline.uniqueKeys.length);
    console.log(JSON.stringify({
      identity: live.identity,
      owner: liveView.owner,
      originWallet: liveView.originWallet,
      tokenUri: liveView.tokenUri,
      metadataGateways: liveView.verifiedGateways,
      recipeSegments: timeline.segments.length,
      verifiedUniqueClips: compressed.size,
      verifiedBytes: [...compressed.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0),
      durationMs: timeline.durationMs,
    }, null, 2));
  } finally {
    clearTimeout(timer);
  }
}

void main();
