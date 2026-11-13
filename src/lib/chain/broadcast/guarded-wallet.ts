import { createWalletClient, custom, keccak256, type EIP1193Parameters, type PublicRpcSchema, type LocalAccount, type Chain, type Hex } from 'viem';
import { publicClient } from '../public-client';

// 所有签名在本地完成。把最后一次锁/预算检查放到真正提交原始交易的 RPC 边界。
export function guardedWallet(account: LocalAccount, chain: Chain, beforeRaw: (hash: Hex) => Promise<void>) {
  return createWalletClient({ account, chain, transport: custom({
    async request(args: EIP1193Parameters<PublicRpcSchema>) {
      if (args.method === 'eth_sendRawTransaction') {
        await beforeRaw(keccak256(args.params[0]));
      }
      return publicClient.request(args, { retryCount: 0 });
    },
  }, { retryCount: 0 }) });
}
