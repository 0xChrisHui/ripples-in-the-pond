// 只读联调：仅做链上读取与 Supabase select，不写库、不发交易。
// 运行：npx tsx --conditions=react-server scripts/p14-i/verify-home-echo-live.ts
import '../_env';
import assert from 'node:assert/strict';
import { resolveHomeEcho } from '@/src/data/echo/home-echo';

async function main(): Promise<void> {
  const cases: readonly [string, string | null][] = [
    ['0x4Fffc941Af305Efa80Afc9754083411859af0F78', '1'],
    ['0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1', '3'],
    ['0x40F72999b7102bA213102bcbFAe8f2378c7Fc7A9', '2'],
    ['0x000000000000000000000000000000000000dEaD', null],
  ];
  for (const [wallet, expected] of cases) {
    for (const address of new Set([wallet, wallet.toLowerCase()])) {
      const startedAt = performance.now();
      const result = await resolveHomeEcho(address);
      const tokenId = result.echo?.tokenId ?? null;
      console.log(`${address} → tokenId=${tokenId}，耗时 ${Math.round(performance.now() - startedAt)} ms`);
      assert.equal(tokenId, expected, '首页必须返回 origin 对应的 Echo');
      if (expected === null) assert.equal(result.echo, null);
      else assert.equal(result.pending, false);
    }
  }
  console.log('P14-I I1 只读联调通过');
}

main().catch((error) => { console.error('P14-I I1 只读联调失败', error); process.exit(1); });
