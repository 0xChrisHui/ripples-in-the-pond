/** P22 服务端纯逻辑测试：派生、凭证编码（对照 Solidity 向量）、状态机与额度。 */
import assert from 'node:assert/strict';
import { keccak256, recoverTypedDataAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { derivePack, PackDeriveError } from '../../src/lib/score-pack/derive';
import { PACK_VOUCHER_TYPES } from '../../src/lib/score-pack/contract';
import {
  buildVoucher, packDomain, soundIdsHash, voucherDigest,
} from '../../src/lib/score-pack/voucher';
import { redact, safeMessage } from '../../src/lib/score-pack/redact';
import {
  canTransition, checkOpQuota, retryDelayMs, settleByChainTruth, shouldAbandon, utcDayStart,
} from '../../src/lib/score-pack/rules';

async function main() {
  const SHA_A = 'a'.repeat(64);
  const SHA_B = 'b'.repeat(64);
  const TX = 'T'.repeat(43);
  const map = {
    sounds: { [SHA_A]: 5, [SHA_B]: 2 },
    tracks: { [TX]: { id: 9, catalogId: 'uuid-9' } },
  };
  const base = { ref: `ar://${TX}`, sha256: 'c'.repeat(64) };

  // 派生：按 SHA-256 去重、升序、不接受未知素材
  {
    const pack = derivePack({ base, sounds: { a: { sha256: SHA_A }, b: { sha256: SHA_B }, c: { sha256: SHA_A } } }, map);
    assert.deepEqual(pack.soundIds, [2n, 5n]);
    assert.equal(pack.trackTokenId, 9n);
    assert.equal(pack.trackCatalogId, 'uuid-9');
    assert.throws(
      () => derivePack({ base, sounds: { a: { sha256: 'd'.repeat(64) } } }, map),
      (e: unknown) => e instanceof PackDeriveError && e.code === 'MISSING_ASSETS' && e.missing.length === 1,
    );
    assert.throws(
      () => derivePack({ base: { ref: 'ar://X', sha256: 'c'.repeat(64) }, sounds: { a: { sha256: SHA_A } } }, map),
      (e: unknown) => e instanceof PackDeriveError && e.missing[0].startsWith('track:'),
    );
    assert.throws(() => derivePack({ base, sounds: {} }, map), (e: unknown) => e instanceof PackDeriveError && e.code === 'EMPTY_PACK');
  }

  // 凭证：与 contracts/test/p22/VoucherVector.t.sol 的 soundIdsHash / typehash 向量一致
  {
    const typehashInput = 'PackVoucher(uint256 scoreTokenId,address holder,uint256 trackTokenId,bytes32 soundIdsHash,uint256 deadline)';
    const fields = PACK_VOUCHER_TYPES.PackVoucher.map((f) => `${f.type} ${f.name}`).join(',');
    assert.equal(`PackVoucher(${fields})`, typehashInput);
    const word = (n: bigint) => n.toString(16).padStart(64, '0');
    assert.equal(soundIdsHash([1n, 2n, 33n]), keccak256(`0x${word(1n)}${word(2n)}${word(33n)}` as Hex));
  }

  // 凭证：签名可恢复为 signer，且 digest 绑定链与合约（跨链不可复用）
  {
    const account = privateKeyToAccount(('0x' + '1'.repeat(64)) as Hex);
    const opener = '0x2222222222222222222222222222222222222222';
    const holder = '0x1111111111111111111111111111111111111111';
    const voucher = buildVoucher(7n, holder, { trackTokenId: 2n, trackCatalogId: 'x', soundIds: [1n, 2n, 33n] }, 1_900_000_000 - 600);
    assert.equal(voucher.deadline, 1_900_000_000n);
    const message = {
      scoreTokenId: voucher.scoreTokenId, holder: voucher.holder, trackTokenId: voucher.trackTokenId,
      soundIdsHash: soundIdsHash(voucher.soundIds), deadline: voucher.deadline,
    };
    const signature = await account.signTypedData({
      domain: packDomain(11155111, opener), types: PACK_VOUCHER_TYPES, primaryType: 'PackVoucher', message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: packDomain(11155111, opener), types: PACK_VOUCHER_TYPES, primaryType: 'PackVoucher', message, signature,
    });
    assert.equal(recovered, account.address);
    assert.notEqual(voucherDigest(11155111, opener, voucher), voucherDigest(1, opener, voucher));
    assert.notEqual(
      voucherDigest(1, opener, voucher),
      voucherDigest(1, '0x3333333333333333333333333333333333333333', voucher),
    );
  }

  // 状态机
  {
    assert.ok(canTransition('queued', 'unsent'));
    assert.ok(!canTransition('opened', 'queued'));
    assert.ok(!canTransition('reverted', 'opened'));
    assert.equal(settleByChainTruth('submitted_unknown', true), 'opened');
    assert.equal(settleByChainTruth('abandoned', true), 'abandoned');
    assert.equal(settleByChainTruth('queued', false), 'queued');
  }

  // 放弃判定：失去所有权/超时放弃；已广播不放弃；链上已开不放弃
  {
    const now = 10_000_000;
    const mk = (over: Partial<Parameters<typeof shouldAbandon>[0]>) => shouldAbandon({
      status: 'awaiting_wallet', createdAtMs: now, nowMs: now, holderStillOwner: true, openedOnChain: false, ...over,
    });
    assert.equal(mk({}), false);
    assert.equal(mk({ holderStillOwner: false }), true);
    assert.equal(mk({ nowMs: now + 31 * 60_000 }), true);
    assert.equal(mk({ status: 'submitted_unknown', holderStillOwner: false }), false);
    assert.equal(mk({ status: 'confirming', nowMs: now + 99 * 60_000 }), false);
    assert.equal(mk({ holderStillOwner: false, openedOnChain: true }), false);
    assert.equal(mk({ status: 'queued', nowMs: now + 99 * 60_000 }), false);
    assert.equal(mk({ status: 'opened', holderStillOwner: false }), false);
  }

  // 额度与重试
  {
    assert.deepEqual(checkOpQuota({ globalToday: 0, userToday: 2 }), { ok: true });
    assert.deepEqual(checkOpQuota({ globalToday: 0, userToday: 3 }), { ok: false, reason: 'USER_LIMIT' });
    assert.deepEqual(checkOpQuota({ globalToday: 200, userToday: 0 }), { ok: false, reason: 'GLOBAL_LIMIT' });
    assert.equal(utcDayStart(Date.UTC(2026, 9, 30, 23, 59)), '2026-10-30T00:00:00.000Z');
    assert.ok(retryDelayMs(1) < retryDelayMs(2));
    assert.ok(retryDelayMs(99) <= 60 * 60_000);
  }
  // 脱敏：RPC 报错里的完整 URL（含 API key）只能留主机名
  {
    const leaked = 'HTTP request failed. URL: https://opt-mainnet.g.alchemy.com/v2/alch_SECRETKEY123 Request body: {}';
    assert.ok(!redact(leaked).includes('SECRETKEY123'));
    assert.ok(redact(leaked).includes('opt-mainnet.g.alchemy.com'));
    assert.ok(!safeMessage(new Error(leaked)).includes('SECRETKEY123'));
    assert.ok(safeMessage(new Error('x'.repeat(2000)), 100).length <= 100);
  }

  console.log('P22 pack tests: ok');
}

main().catch((error) => { console.error(error); process.exit(1); });
