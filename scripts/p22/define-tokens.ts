/**
 * P22：把素材 metadata 地址登记到链上（PondSoundNFT / PondTrackNFT.defineTokens）。
 * 只追加：已登记的 tokenId 自动跳过；--dry-run 只模拟不发交易。
 * 环境变量：CHAIN_ID、RPC_URL、SOUNDS、TRACKS、ADMIN_WALLET_PATH（本地 admin 钱包 JSON，含 privateKey）。
 * 用法：tsx scripts/p22/define-tokens.ts [--dry-run]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, getAddress, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';

const ABI = [
  { type: 'function', name: 'defineTokens', stateMutability: 'nonpayable',
    inputs: [{ name: 'ids', type: 'uint256[]' }, { name: 'uris', type: 'string[]' }], outputs: [] },
  { type: 'function', name: 'isDefined', stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;
const CHAINS = { 1: mainnet, 10: optimism, 11155111: sepolia, 11155420: optimismSepolia } as const;
const BATCH = 40;

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
};

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const chain = CHAINS[Number(env('CHAIN_ID')) as keyof typeof CHAINS];
  if (!chain) throw new Error('不支持的 CHAIN_ID');
  const uris = JSON.parse(readFileSync(path.resolve('data/p22/asset-uris.json'), 'utf8')) as {
    sounds: Record<string, string>; tracks: Record<string, string>;
  };
  const pub = createPublicClient({ chain, transport: http(env('RPC_URL')) });
  const wallet = JSON.parse(readFileSync(env('ADMIN_WALLET_PATH'), 'utf8')) as { privateKey: Hex };
  const account = privateKeyToAccount(wallet.privateKey);
  const client = createWalletClient({ account, chain, transport: http(env('RPC_URL')) });
  console.log(`链 ${chain.name}，admin ${account.address}${dryRun ? '（dry-run）' : ''}`);

  for (const [label, address, map] of [
    ['sounds', getAddress(env('SOUNDS')), uris.sounds],
    ['tracks', getAddress(env('TRACKS')), uris.tracks],
  ] as const) {
    const ids = Object.keys(map).map(Number).sort((a, b) => a - b);
    const pending: number[] = [];
    for (const id of ids) {
      const done = await pub.readContract({ address, abi: ABI, functionName: 'isDefined', args: [BigInt(id)] });
      if (!done) pending.push(id);
    }
    console.log(`${label}: 共 ${ids.length}，待登记 ${pending.length}`);
    for (const group of chunk(pending, BATCH)) {
      const args = [group.map(BigInt), group.map((id) => map[String(id)])] as const;
      const { request } = await pub.simulateContract({ address, abi: ABI, functionName: 'defineTokens', args, account });
      if (dryRun) { console.log(`  [模拟通过] ${group[0]}–${group[group.length - 1]}`); continue; }
      const hash = await client.writeContract(request);
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error(`${label} 登记交易失败 ${hash}`);
      console.log(`  已登记 ${group[0]}–${group[group.length - 1]} tx ${hash} gas ${receipt.gasUsed}`);
    }
    // 公共节点可能还没同步到刚确认的区块：读回最多重试 6 次（每次间隔 5 秒）再判定缺失
    let missing: number[] = ids;
    for (let attempt = 0; attempt < 6 && missing.length; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 5_000));
      const next: number[] = [];
      for (const id of missing) {
        if (!await pub.readContract({ address, abi: ABI, functionName: 'isDefined', args: [BigInt(id)] })) next.push(id);
      }
      missing = next;
    }
    if (!dryRun && missing.length) throw new Error(`${label} 仍有未登记 ${missing.join(',')}`);
  }
  console.log(dryRun ? 'dry-run 完成' : '登记完成并已读回核对');
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
