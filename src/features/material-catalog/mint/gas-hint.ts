import { formatEther, getAddress, type Address } from 'viem';

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
export type GasHint = { fee: bigint; balance: bigint; enough: boolean };

// 实际 redeem 约 15 万 Gas；与发送前预检一致，余额须覆盖 1.2 倍上限才放行。
const TYPICAL_GAS = 150000n, GAS_LIMIT = 180000n;

/** 点击领取前读取付款钱包当前链的余额与 Gas 价；链不一致或读取失败返回 null，不阻塞后续预检。 */
export async function readGasHint(provider: Eip1193, account: Address, chainId: number): Promise<GasHint | null> {
  try {
    if (Number(await provider.request({ method: 'eth_chainId' })) !== chainId) return null;
    const [price, balance] = await Promise.all([
      provider.request({ method: 'eth_gasPrice' }),
      provider.request({ method: 'eth_getBalance', params: [getAddress(account), 'latest'] })]);
    const gasPrice = BigInt(String(price)), held = BigInt(String(balance));
    return { fee: TYPICAL_GAS * gasPrice, balance: held, enough: held >= GAS_LIMIT * gasPrice };
  } catch { return null; }
}

export function formatEth(value: bigint): string {
  const amount = Number(formatEther(value));
  return amount === 0 ? '0' : amount < 0.000001 ? '<0.000001' : amount.toFixed(6);
}
