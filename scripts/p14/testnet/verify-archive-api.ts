import '../../_env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SignJWT, importPKCS8 } from 'jose';
import { privateKeyToAccount } from 'viem/accounts';

const baseUrl = process.argv[2] ?? 'http://localhost:3100';
const state = JSON.parse(readFileSync(
  join(homedir(), '.config', 'ripples-in-the-pond', 'p14-testnet-wallets.json'), 'utf8',
)) as { chainId: number; wallets: Record<string, `0x${string}`> };
if (state.chainId !== 11155420) throw new Error('测试钱包链错误');

async function token(address: string): Promise<string> {
  const pem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!pem) throw new Error('JWT_PRIVATE_KEY 未配置');
  const key = await importPKCS8(pem, 'RS256');
  return new SignJWT({ evm: address }).setProtectedHeader({ alg: 'RS256' })
    .setSubject(crypto.randomUUID()).setIssuer('ripples').setAudience('ripples-app')
    .setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('5m').sign(key);
}

async function archive(label: 'W1' | 'W2' | 'W3') {
  const address = privateKeyToAccount(state.wallets[label]).address;
  const response = await fetch(`${baseUrl}/api/me/pond-echoes`, {
    headers: { authorization: `Bearer ${await token(address)}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${label} archive HTTP ${response.status}: ${JSON.stringify(body)}`);
  return { label, address, body };
}

async function main() {
  const [w1, w2, w3] = await Promise.all([archive('W1'), archive('W2'), archive('W3')]);
  const w1Token = w1.body.echoes.find((item: { tokenId: string }) => item.tokenId === '1');
  const w2Token = w2.body.echoes.find((item: { tokenId: string }) => item.tokenId === '2');
  const w3Token = w3.body.echoes.find((item: { tokenId: string }) => item.tokenId === '1');
  const w3OwnToken = w3.body.echoes.find((item: { tokenId: string }) => item.tokenId === '3');
  if (w1Token?.relation !== 'origin-history' || w1Token.currentOwner !== w3.address) {
    throw new Error('W1 未显示已转出的 origin 历史');
  }
  if (w3Token?.relation !== 'current-owner' || w3Token.originWallet !== w1.address) {
    throw new Error('W3 未显示当前持有且 origin 保持 W1');
  }
  if (w2Token?.relation !== 'current-owner' || w2Token.originWallet !== w2.address) {
    throw new Error('W2 当前持有档案不正确');
  }
  if (w3OwnToken?.relation !== 'current-owner' || w3OwnToken.originWallet !== w3.address) {
    throw new Error('W3 自有 Token #3 档案不正确');
  }
  if (w1.body.onChainTotal !== 0 || w2.body.onChainTotal !== 1 || w3.body.onChainTotal !== 2) {
    throw new Error('转让后的 onChainTotal 汇总不正确');
  }
  console.log(JSON.stringify({
    W1: { onChainTotal: w1.body.onChainTotal, relation: w1Token.relation, tokenId: '1' },
    W2: { onChainTotal: w2.body.onChainTotal, relation: w2Token.relation, tokenId: '2' },
    W3: { onChainTotal: w3.body.onChainTotal, relations: [w3Token.relation, w3OwnToken.relation],
      tokenIds: ['1', '3'] },
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
