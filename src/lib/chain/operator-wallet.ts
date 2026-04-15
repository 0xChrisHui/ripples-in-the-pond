import 'server-only';
// 运营钱包：用项目方私钥代付 gas，替用户发交易

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { optimismSepolia } from 'viem/chains';

const account = privateKeyToAccount(
  process.env.OPERATOR_PRIVATE_KEY as `0x${string}`,
);

export const operatorWalletClient = createWalletClient({
  account,
  chain: optimismSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
});

export const publicClient = createPublicClient({
  chain: optimismSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
});
