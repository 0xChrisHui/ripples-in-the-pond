/**
 * P22 测试网端到端：用服务端同一套凭证代码签名 → 任意地址提交 open → 读链核对 TBA 余额。
 * 只用于测试网。环境变量：RPC_URL、SUBMITTER_KEY、P22_SIGNER_PRIVATE_KEY、P22_SIGNER_ADDRESS、
 * SCORE、OPENER、SOUNDS、TRACKS、TOKEN_ID。
 */
import { createPublicClient, createWalletClient, getAddress, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimismSepolia } from 'viem/chains';
import { POND_ASSET_ABI, SCORE_OWNER_ABI, SCORE_PACK_OPENER_ABI } from '../../src/lib/score-pack/contract';
import { buildVoucher, signVoucher } from '../../src/lib/score-pack/voucher';

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
};

async function main() {
  const chainId = optimismSepolia.id;
  const publicClient = createPublicClient({ chain: optimismSepolia, transport: http(env('RPC_URL')) });
  const submitter = privateKeyToAccount(env('SUBMITTER_KEY') as Hex);
  const wallet = createWalletClient({ account: submitter, chain: optimismSepolia, transport: http(env('RPC_URL')) });
  const opener = getAddress(env('OPENER'));
  const tokenId = BigInt(env('TOKEN_ID'));

  const holder = await publicClient.readContract({
    address: getAddress(env('SCORE')), abi: SCORE_OWNER_ABI, functionName: 'ownerOf', args: [tokenId],
  });
  const voucher = buildVoucher(tokenId, holder, { trackTokenId: 1n, trackCatalogId: '', soundIds: [1n, 2n, 3n] });
  const signed = await signVoucher(chainId, opener, voucher);
  console.log('holder', holder, 'submitter', submitter.address, '（提交者 ≠ 持有人：', submitter.address !== holder, '）');

  const hash = await wallet.writeContract({
    address: opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'open',
    args: [voucher, signed.signer, signed.signature],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('open tx', hash, receipt.status, 'gas', receipt.gasUsed);

  const account = await publicClient.readContract({
    address: opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'accountOf', args: [tokenId],
  });
  const [track, sounds, opened] = await Promise.all([
    publicClient.readContract({ address: getAddress(env('TRACKS')), abi: POND_ASSET_ABI, functionName: 'balanceOfBatch', args: [[account], [1n]] }),
    publicClient.readContract({ address: getAddress(env('SOUNDS')), abi: POND_ASSET_ABI, functionName: 'balanceOfBatch', args: [[account, account, account], [1n, 2n, 3n]] }),
    publicClient.readContract({ address: opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'opened', args: [tokenId] }),
  ]);
  console.log('TBA', account, 'opened', opened, 'track', track, 'sounds', sounds);

  try {
    await wallet.writeContract({
      address: opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'open',
      args: [voucher, signed.signer, signed.signature],
    });
    console.log('!! 第二次开包居然没被拒绝');
    process.exitCode = 1;
  } catch {
    console.log('第二次开包被拒绝：符合预期');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
