import '../../_env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createPublicClient, createWalletClient, decodeEventLog, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimismSepolia } from 'viem/chains';
import { SCORE_NFT_ABI, SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';

const labels = new Set(['W0', 'W1', 'W2', 'W3']);
const label = process.argv[2];
const count = Number(process.argv[3] ?? '1');
if (!label || !labels.has(label) || !Number.isInteger(count) || count < 1 || count > 2) {
  throw new Error('用法：mint-score.ts <W0|W1|W2|W3> [1|2]');
}
if (process.env.NEXT_PUBLIC_CHAIN_ID !== '11155420') throw new Error('只允许 OP Sepolia');

const state = JSON.parse(readFileSync(
  join(homedir(), '.config', 'ripples-in-the-pond', 'p14-testnet-wallets.json'), 'utf8',
)) as { chainId: number; wallets: Record<string, `0x${string}`> };
if (state.chainId !== 11155420) throw new Error('测试钱包链错误');
const recipient = privateKeyToAccount(state.wallets[label]).address;
const contract = getAddress(SCORE_NFT_ADDRESS);
const account = privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY as `0x${string}`);
const transport = http(process.env.ALCHEMY_RPC_URL);
const operatorWalletClient = createWalletClient({ account, chain: optimismSepolia, transport });
const publicClient = createPublicClient({ chain: optimismSepolia, transport });

async function main() {
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  const hashes = [] as `0x${string}`[];
  for (let index = 0; index < count; index++) {
    try {
      hashes.push(await operatorWalletClient.writeContract({
        address: contract, abi: SCORE_NFT_ABI, functionName: 'mint', args: [recipient], nonce: nonce + index,
      }));
    } catch (error) {
      console.error(JSON.stringify({ label, recipient, alreadyBroadcast: hashes }, null, 2));
      throw error;
    }
  }
  const receipts = await Promise.all(hashes.map((hash) =>
    publicClient.waitForTransactionReceipt({ hash, confirmations: 20 })));
  const results = receipts.map((receipt, index) => {
    const transfer = receipt.logs.map((log) => {
      try { return decodeEventLog({ abi: SCORE_NFT_ABI, data: log.data, topics: log.topics }); }
      catch { return null; }
    }).find((event) => event?.eventName === 'Transfer');
    if (!transfer || transfer.eventName !== 'Transfer' || transfer.args.to !== recipient) {
      throw new Error('Score mint receipt 缺少目标 Transfer');
    }
    return { tokenId: transfer.args.tokenId.toString(), hash: hashes[index],
      blockNumber: receipt.blockNumber.toString(), confirmations: 20 };
  });
  if (count === 2 && receipts[0].blockNumber !== receipts[1].blockNumber) {
    console.error(JSON.stringify({ label, recipient, results }, null, 2));
    throw new Error('两笔 Score 交易未进入同一区块；不得把本轮作为同块并发证据');
  }
  console.log(JSON.stringify({ label, recipient, results }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
