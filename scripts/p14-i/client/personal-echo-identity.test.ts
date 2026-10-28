import assert from 'node:assert/strict';
import {
  createPersonalEchoCache, identityKeyOf, visibleEcho,
} from '@/src/hooks/echo/personal-echo-identity';
import { echo, otherEcho } from '@/scripts/p14-i/echo-fixtures';

const auth = {
  authenticated: true, authSource: 'semi', userId: '用户甲',
  evmAddress: '0xAbCd000000000000000000000000000000000001',
};
const keyA = 'semi:用户甲:0xabcd000000000000000000000000000000000001';
const keyB = 'semi:用户乙:0xabcd000000000000000000000000000000000001';

function main() {
  assert.equal(identityKeyOf({ ...auth, authenticated: false }), null, '未登录不能取得身份 key');
  for (const field of ['authSource', 'userId', 'evmAddress'] as const) {
    assert.equal(identityKeyOf({ ...auth, [field]: null }), null, `缺少 ${field} 不能查询`);
  }
  assert.equal(identityKeyOf(auth), keyA);
  assert.equal(identityKeyOf({ ...auth, evmAddress: auth.evmAddress.toLowerCase() }), keyA);
  assert.equal(identityKeyOf({ ...auth, userId: '用户乙' }), keyB);
  assert.notEqual(identityKeyOf({ ...auth, authSource: 'privy' }), keyA);
  assert.notEqual(identityKeyOf({ ...auth, evmAddress: `${auth.evmAddress.slice(0, -1)}2` }), keyA);

  const snapshot = { key: keyA, echo };
  assert.equal(visibleEcho(true, keyA, snapshot), echo);
  assert.equal(visibleEcho(true, keyB, snapshot), null, '换身份后旧快照立即不可见');
  assert.equal(visibleEcho(true, null, snapshot), null, '退出登录立即不可见');
  assert.equal(visibleEcho(false, keyA, snapshot), null, '禁用时不可见');
  assert.equal(visibleEcho(true, keyA, { key: keyA, echo: null }), null);

  const cache = createPersonalEchoCache();
  assert.equal(cache.remember(keyA, echo), echo);
  const copy = { ...echo, clips: { ...echo.clips } };
  assert.notEqual(copy, echo);
  assert.equal(cache.remember(keyA, copy), echo, '同一 Echo identity 保持缓存对象引用');
  assert.equal(cache.get(keyA), echo);
  assert.equal(cache.get(keyB), null, '用户乙不能读到用户甲的缓存');
  assert.equal(cache.remember(keyB, copy), copy, '同一 Echo 也不能跨用户复用缓存引用');
  assert.equal(cache.get(keyA), echo);
  assert.equal(cache.remember(keyA, otherEcho), otherEcho, '新的 Echo identity 必须更新对象');
  assert.equal(cache.remember(keyA, null), null, '空查询必须清理该身份缓存');
  assert.equal(cache.get(keyA), null); assert.equal(cache.get(keyB), copy);
  cache.remember(keyA, echo); cache.forget(keyB);
  assert.equal(cache.get(keyB), null); assert.equal(cache.get(keyA), echo);
  cache.remember(keyB, otherEcho);
  cache.syncAuthentication(true);
  assert.equal(cache.get(keyA), echo); assert.equal(cache.get(keyB), otherEcho);
  cache.syncAuthentication(false);
  assert.equal(cache.get(keyA), null); assert.equal(cache.get(keyB), null);
  cache.remember(keyA, echo); cache.remember(keyB, otherEcho); cache.clear();
  assert.equal(cache.get(keyA), null); assert.equal(cache.get(keyB), null);
  assert.equal(createPersonalEchoCache().get(keyA), null, '不同缓存实例互不影响');
  console.log('个人 Echo 身份与缓存隔离测试通过');
}

main();
