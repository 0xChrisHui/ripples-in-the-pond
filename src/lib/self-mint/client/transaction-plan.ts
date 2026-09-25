import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { ETHEREUM_SCORE_ABI, type MintAuthorization } from '../ethereum-score-contract';

export type VoucherResponse = {
  orderId: Hex;
  chainId: 1 | 11155111;
  scoreContract: Address;
  tokenUri: string;
  authorizer: Address;
  digest: Hex;
  signature: Hex;
  authorization: Omit<MintAuthorization, 'tokenId' | 'deadline'> & {
    tokenId: string;
    deadline: number;
  };
};

export type MintTransactionPlan = {
  voucher: VoucherResponse;
  walletAddress: Address;
  chain: typeof mainnet | typeof sepolia;
  gasLimit: bigint;
  estimatedFeeWei: bigint;
  hasEnoughBalance: boolean;
  data: Hex;
};

export async function buildMintTransactionPlan(input: {
  orderId: Hex;
  walletAddress: Address;
  authorizedFetch: (url: string, init: RequestInit) => Promise<unknown>;
}): Promise<MintTransactionPlan> {
  const voucher = await input.authorizedFetch('/api/self-mint/authorization', {
    method: 'POST', body: JSON.stringify({ orderId: input.orderId, walletAddress: input.walletAddress }),
  }) as VoucherResponse;
  if (getAddress(voucher.authorization.recipient) !== input.walletAddress) {
    throw new Error('凭证接收人与当前钱包不一致');
  }

  const chain = voucher.chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http() });
  const authorization: MintAuthorization = {
    ...voucher.authorization,
    tokenId: BigInt(voucher.authorization.tokenId),
    deadline: BigInt(voucher.authorization.deadline),
  };
  const args = [authorization, voucher.tokenUri, voucher.authorizer, voucher.signature] as const;
  const [gas, fees, balance] = await Promise.all([
    client.estimateContractGas({
      address: voucher.scoreContract, abi: ETHEREUM_SCORE_ABI,
      functionName: 'redeem', args, account: input.walletAddress,
    }),
    client.estimateFeesPerGas(),
    client.getBalance({ address: input.walletAddress }),
  ]);
  const gasLimit = gas * 120n / 100n;
  const maxFee = fees.maxFeePerGas ?? fees.gasPrice;
  if (!maxFee) throw new Error('暂时无法取得 Gas 价格');
  const estimatedFeeWei = gasLimit * maxFee;
  return {
    voucher,
    walletAddress: input.walletAddress,
    chain,
    gasLimit,
    estimatedFeeWei,
    hasEnoughBalance: balance >= estimatedFeeWei,
    data: encodeFunctionData({ abi: ETHEREUM_SCORE_ABI, functionName: 'redeem', args }),
  };
}
