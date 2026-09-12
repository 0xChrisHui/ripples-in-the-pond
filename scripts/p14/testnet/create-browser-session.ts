import '../../_env';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { SignJWT, importPKCS8 } from 'jose';
import { privateKeyToAccount } from 'viem/accounts';

if (process.env.NEXT_PUBLIC_CHAIN_ID !== '11155420') throw new Error('只允许 OP Sepolia');
const state = JSON.parse(readFileSync(
  join(homedir(), '.config', 'ripples-in-the-pond', 'p14-testnet-wallets.json'), 'utf8',
)) as { chainId: number; wallets: Record<string, `0x${string}`> };
if (state.chainId !== 11155420) throw new Error('测试钱包链错误');

async function main() {
  const pem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!pem) throw new Error('JWT_PRIVATE_KEY 未配置');
  const key = await importPKCS8(pem, 'RS256');
  const sessions: Record<string, { address: string; token: string }> = {};
  for (const label of ['W0', 'W1', 'W2', 'W3']) {
    const address = privateKeyToAccount(state.wallets[label]).address;
    const token = await new SignJWT({ evm: address }).setProtectedHeader({ alg: 'RS256' })
      .setSubject(crypto.randomUUID()).setIssuer('ripples').setAudience('ripples-app')
      .setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('45m').sign(key);
    sessions[label] = { address, token };
  }
  const output = join(tmpdir(), 'p14-browser-sessions.json');
  writeFileSync(output, `${JSON.stringify(sessions, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({ output, labels: Object.keys(sessions) }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
