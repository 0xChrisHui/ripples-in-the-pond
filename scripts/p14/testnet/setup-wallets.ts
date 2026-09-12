import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const walletPath = join(homedir(), '.config', 'ripples-in-the-pond', 'p14-testnet-wallets.json');
const labels = ['W0', 'W1', 'W2', 'W3'] as const;
type WalletFile = { chainId: 11155420; wallets: Record<typeof labels[number], `0x${string}`> };

function validate(value: WalletFile): WalletFile {
  if (value.chainId !== 11155420) throw new Error('P14 测试钱包只允许 OP Sepolia');
  for (const label of labels) {
    if (!/^0x[0-9a-f]{64}$/.test(value.wallets[label] ?? '')) {
      throw new Error(`${label} 私钥格式无效`);
    }
  }
  return value;
}

let state: WalletFile;
if (existsSync(walletPath)) {
  state = validate(JSON.parse(readFileSync(walletPath, 'utf8')) as WalletFile);
} else {
  state = {
    chainId: 11155420,
    wallets: Object.fromEntries(labels.map((label) => [label, generatePrivateKey()])) as WalletFile['wallets'],
  };
  mkdirSync(dirname(walletPath), { recursive: true });
  writeFileSync(walletPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

console.log(JSON.stringify({
  path: walletPath,
  chainId: state.chainId,
  wallets: Object.fromEntries(labels.map((label) => [label, privateKeyToAccount(state.wallets[label]).address])),
}, null, 2));
