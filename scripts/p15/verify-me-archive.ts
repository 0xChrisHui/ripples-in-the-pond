import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  archiveCacheKey,
  clearArchiveCache,
  readArchiveCache,
  validCachedEcho,
  validCachedScore,
  writeArchiveCache,
} from '../../src/hooks/me/archive-cache';
import { getDrafts, saveDraft } from '../../src/lib/draft-store';
import { fetchMyEchoes } from '../../src/data/echo/client';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  get length(): number { return this.values.size; }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'location', { value: { origin: 'https://one.example' }, configurable: true });

const score = {
  id: 'queue-1', queueId: 'queue-1', status: 'pending' as const,
  trackTitle: '真实曲目', eventCount: 3, failureKind: null,
  submittedAt: '2026-09-06T00:00:00.000Z',
};
const privy = { authSource: 'privy' as const, userId: 'user-a' };
const semi = { authSource: 'semi' as const, userId: 'user-a' };
const echoAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const echoIdentity = { ...privy, evmAddress: echoAddress.toUpperCase().replace('0X', '0x') };
const echo = {
  key: 'owned:1', tokenId: '1', name: 'Pond Echo #1',
  originWallet: echoAddress, currentOwner: echoAddress, tokenUri: 'ar://metadata',
  status: 'owned' as const, relation: 'current-owner' as const, hasError: false,
};

process.env.NEXT_PUBLIC_CHAIN_ID = '10';
process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS = '0x1111111111111111111111111111111111111111';

writeArchiveCache(privy, 'scores', '/api/me/score-nfts', [score]);
assert.deepEqual(readArchiveCache(privy, 'scores', validCachedScore)?.items, [score]);
assert.equal(readArchiveCache(semi, 'scores', validCachedScore), null, '登录源必须隔离');
assert.equal(
  readArchiveCache({ authSource: 'privy', userId: 'user-b' }, 'scores', validCachedScore),
  null,
  'owner 必须隔离',
);

const echoKey = archiveCacheKey(echoIdentity, 'echoes');
assert.ok(echoKey);
const decodedEchoKey = decodeURIComponent(echoKey);
assert.match(decodedEchoKey, /privy:user-a:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd:echoes$/);
assert.match(decodedEchoKey, /\|10\|0x1111111111111111111111111111111111111111:/);
writeArchiveCache(echoIdentity, 'echoes', '/api/me/pond-echoes', [echo]);
assert.deepEqual(readArchiveCache(
  { ...privy, evmAddress: echoAddress }, 'echoes', validCachedEcho,
)?.items, [echo], '同一钱包不同大小写必须命中同一份缓存');
assert.equal(readArchiveCache(
  { ...semi, evmAddress: echoAddress }, 'echoes', validCachedEcho,
), null, 'Echo 登录源必须隔离');
assert.equal(readArchiveCache(
  { ...privy, userId: 'user-b', evmAddress: echoAddress }, 'echoes', validCachedEcho,
), null, 'Echo userId 必须隔离');
assert.equal(readArchiveCache(
  { ...privy, evmAddress: '0x2222222222222222222222222222222222222222' }, 'echoes', validCachedEcho,
), null, 'Echo 钱包地址必须隔离');
process.env.NEXT_PUBLIC_CHAIN_ID = '11155420';
assert.equal(readArchiveCache(echoIdentity, 'echoes', validCachedEcho), null, 'Echo 链必须隔离');
process.env.NEXT_PUBLIC_CHAIN_ID = '10';
process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS = '0x3333333333333333333333333333333333333333';
assert.equal(readArchiveCache(echoIdentity, 'echoes', validCachedEcho), null, 'Echo 合约必须隔离');
process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS = '0x1111111111111111111111111111111111111111';

writeArchiveCache(privy, 'scores', '/api/me/score-nfts', []);
assert.deepEqual(readArchiveCache(privy, 'scores', validCachedScore)?.items, []);
Object.defineProperty(globalThis, 'location', { value: { origin: 'https://two.example' }, configurable: true });
assert.equal(readArchiveCache(privy, 'scores', validCachedScore), null, '环境必须隔离');
Object.defineProperty(globalThis, 'location', { value: { origin: 'https://one.example' }, configurable: true });
const cacheKey = storage.key(0)!;
const expired = JSON.parse(storage.getItem(cacheKey)!);
expired.savedAt = '2000-01-01T00:00:00.000Z';
storage.setItem(cacheKey, JSON.stringify(expired));
assert.equal(readArchiveCache(privy, 'scores', validCachedScore), null, '超过保留期必须删除');
writeArchiveCache(privy, 'scores', '/api/me/score-nfts', [score]);
clearArchiveCache(privy);
assert.equal(readArchiveCache(privy, 'scores', validCachedScore), null, '登出必须清当前身份缓存');
clearArchiveCache(echoIdentity);
assert.equal(readArchiveCache(echoIdentity, 'echoes', validCachedEcho), null, '登出必须清当前钱包 Echo 缓存');

storage.setItem('ripples_drafts', JSON.stringify([{
  trackId: 'track-legacy',
  eventsData: [{ key: 'a', time: 0, duration: 10 }],
  createdAt: new Date().toISOString(),
}]));
const legacyId = getDrafts()[0]?.clientDraftId;
assert.match(legacyId ?? '', /^legacy-[a-f0-9]{8}$/);
assert.equal(getDrafts()[0]?.clientDraftId, legacyId, '旧草稿补出的身份必须稳定');

saveDraft({
  trackId: 'track-new',
  eventsData: [{ key: 'b', time: 1, duration: 10 }],
  createdAt: new Date().toISOString(),
});
assert.ok(getDrafts().find((draft) => draft.trackId === 'track-new')?.clientDraftId);

async function verifyMigration(): Promise<void> {
  const [migration, echoHook, echoRoute] = await Promise.all([
    readFile('supabase/migrations/phase-15/050_pending_scores_client_draft_id.sql', 'utf8'),
    readFile('src/hooks/me/useOwnedEchoes.ts', 'utf8'),
    readFile('app/api/me/pond-echoes/route.ts', 'utf8'),
  ]);
  assert.match(migration, /unique index if not exists pending_scores_user_client_draft_unique/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /p_client_draft_id/);
  assert.match(echoHook, /上次链上确认/);
  assert.match(echoHook, /fetchMyEchoes\(token, controller\.signal\)/);
  assert.match(echoRoute, /timing\.measure\('rpc'/);
  assert.match(echoRoute, /timing\.response/);
  const previousFetch = globalThis.fetch;
  let receivedSignal: AbortSignal | null | undefined;
  try {
    globalThis.fetch = (async (_input, init) => {
      receivedSignal = init?.signal;
      return new Response(JSON.stringify({
        echoes: [echo], onChainTotal: 1, truncated: false, originStatusUnavailable: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const controller = new AbortController();
    assert.equal((await fetchMyEchoes('token', controller.signal)).echoes.length, 1);
    assert.equal(receivedSignal, controller.signal, 'Echo 请求必须透传 AbortSignal');
  } finally {
    globalThis.fetch = previousFetch;
  }
  console.log('/me owner、Echo 链上缓存与草稿幂等合同验证通过');
}

void verifyMigration();
