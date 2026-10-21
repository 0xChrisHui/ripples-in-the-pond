import '../_env';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/me/pond-echo/home/route';
import { toFeaturedEcho } from '@/src/data/echo/featured';
import { HOME_ECHO_CACHE_CONTROL, isOriginEchoPending, resolveHomeEcho } from '@/src/data/echo/home-echo';
import type { EchoViewData } from '@/src/data/echo/types';
import type { RecipeV1, WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';

const origin = '0x4Fffc941Af305Efa80Afc9754083411859af0F78';
const recipient = '0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1';
const chainId = 11155420;

function fixture(owner = origin, tokenId = '3'): EchoViewData {
  return {
    tokenId, owner, originWallet: origin,
    contractAddress: '0x43E86Af0437386a8Af7A3b0c806d917c030BAb38',
    tokenUri: `ar://${'M'.repeat(43)}`, metadataTxId: 'M'.repeat(43),
    network: 'OP Sepolia', explorerUrl: 'https://explorer.test/echo',
    imageUrl: 'https://gateway.test/image', verifiedGateways: ['https://gateway.test'],
    metadata: {
      name: 'Pond Echo · 4Fff—0F78', description: '测试钱包的池中回声',
      image: `ar://${'I'.repeat(43)}`, animation_url: `ar://${'D'.repeat(43)}`,
      external_url: 'https://pond.test/echo/3', attributes: [],
      properties: {
        recipeVersion: 1, recipe: 'a'.repeat(36) as RecipeV1, originWallet: origin,
        sourceScoreTokenId: 1, clipManifest: `ar://${'C'.repeat(43)}`,
        clipManifestSha256: 'c'.repeat(64), durationMs: 12_000,
        clips: { a: { uri: `ar://${'A'.repeat(43)}`, sha256: 'a'.repeat(64), durationMs: 1_000 } },
      },
    },
  };
}

function depsFor(
  view: EchoViewData | null = null,
  status: WalletRecipeQueueStatus | null = null,
  unavailable = false,
) {
  return {
    chainId,
    getEchoByOrigin: async () => view,
    readOriginQueue: async () => ({
      row: status === null ? null : {
        status, token_id: null, token_uri: null, origin_wallet: origin, last_error: null,
      },
      unavailable,
    }),
  };
}

async function verifyOriginSelection(): Promise<void> {
  assert.deepEqual(await resolveHomeEcho(origin, depsFor()), { echo: null, pending: false });
  for (const owner of [origin, recipient]) {
    const view = fixture(owner);
    const result = await resolveHomeEcho(origin, {
      ...depsFor(view),
      getEchoByOrigin: async (wallet: string) => {
        assert.equal(wallet, origin);
        return view;
      },
      readOriginQueue: async () => { throw new Error('已生成 Echo 时不能读取队列'); },
    });
    assert.equal(result.pending, false);
    assert.ok(result.echo);
    const identity = `eip155:${chainId}:${view.contractAddress.toLowerCase()}:3`;
    assert.equal(result.echo.tokenId, '3');
    assert.equal(result.echo.contractAddress, view.contractAddress.toLowerCase());
    assert.equal(result.echo.identity, identity);
    assert.equal(result.echo.href, '/echo/3');
    assert.equal(result.echo.playbackId, `pond-echo:${identity}`);
    assert.equal(result.echo.title, view.metadata.name);
    assert.deepEqual(result.echo.recipe, view.metadata.properties.recipe);
    assert.deepEqual(result.echo.clips, view.metadata.properties.clips);
    assert.equal(result.echo.durationMs, view.metadata.properties.durationMs);
    assert.equal('owner' in result.echo, false);
    assert.equal('originWallet' in result.echo, false);
  }
  const transferred = fixture(recipient, '1');
  const result = await resolveHomeEcho(recipient, {
    ...depsFor(),
    getEchoByOrigin: async (wallet: string) => (
      wallet === transferred.originWallet ? transferred : null
    ),
  });
  assert.deepEqual(result, { echo: null, pending: false }, '持有转入的 Echo 不代表自己生成过');
}

async function verifyPending(): Promise<void> {
  const cases: Record<WalletRecipeQueueStatus, boolean> = {
    pending: true, preparing_media: true, uploading_metadata: true,
    minting_onchain: true, confirming_onchain: true, safe_retry: true,
    success: true, manual_review: false, excluded_prelaunch: false,
  };
  for (const [status, expected] of Object.entries(cases)) {
    const queueStatus = status as WalletRecipeQueueStatus;
    assert.equal(isOriginEchoPending(queueStatus), expected, status);
    assert.deepEqual(await resolveHomeEcho(origin, depsFor(null, queueStatus)), {
      echo: null, pending: expected,
    }, status);
  }
  assert.equal(isOriginEchoPending(null), false);
  const previousError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    assert.deepEqual(await resolveHomeEcho(origin, depsFor(null, 'pending', true)), {
      echo: null, pending: false,
    });
    assert.equal(errors.length, 1, '队列不可用时必须记录一行错误');
  } finally {
    console.error = previousError;
  }
  const failure = new Error('链上读取失败');
  await assert.rejects(resolveHomeEcho(origin, {
    ...depsFor(), getEchoByOrigin: async () => { throw failure; },
    readOriginQueue: async () => { throw new Error('链上错误后不能读取队列'); },
  }), (error: unknown) => error === failure);
}

async function verifyAnonymousRoute(): Promise<void> {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('匿名请求不应访问网络或数据库'); };
  try {
    const response = await GET(new Request('http://localhost/api/me/pond-echo/home') as NextRequest);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: '未登录' });
    assert.equal(HOME_ECHO_CACHE_CONTROL, 'private, no-store');
    assert.equal(response.headers.get('Cache-Control'), HOME_ECHO_CACHE_CONTROL);
    assert.match(response.headers.get('Server-Timing') ?? '', /auth;dur=/);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function main(): Promise<void> {
  assert.equal(toFeaturedEcho(fixture(), chainId).tokenId, '3');
  for (const tokenId of ['0', 'abc', '-1', '1.5', '01', '', '3\n']) {
    assert.throws(() => toFeaturedEcho(fixture(origin, tokenId), chainId));
  }
  await verifyOriginSelection();
  await verifyPending();
  await verifyAnonymousRoute();
  console.log('P14-I I1 私有首页 Echo 测试通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
