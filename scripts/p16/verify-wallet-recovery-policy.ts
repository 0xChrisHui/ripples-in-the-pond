import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function requirePattern(source: string, pattern: RegExp, message: string): void {
  if (!pattern.test(source)) throw new Error(message);
}

function forbidPattern(source: string, pattern: RegExp, message: string): void {
  if (pattern.test(source)) throw new Error(message);
}

const wallet = read('src/hooks/useEthereumScoreMint.ts');
requirePattern(wallet, /getEthereumProvider/, '钱包发送必须使用 Privy 已连接钱包 provider');
requirePattern(wallet, /createWalletClient/, '钱包发送必须使用唯一 viem wallet client');
requirePattern(wallet, /account:\s*walletAddress/, '钱包发送必须固定已验证外部钱包');
requirePattern(wallet, /chain,/, '钱包发送必须显式固定凭证链');
requirePattern(wallet, /walletClient\.sendTransaction/, '钱包发送必须走已核验 wallet client');
forbidPattern(wallet, /useSendTransaction|window\.ethereum/,
  '禁止误用 embedded-wallet 发送接口或绕过 Privy 直接读取注入 provider');

const reconcile = read('src/lib/self-mint/reconcile.ts');
for (const truth of ['tokenIdByOrderId', 'ScoreRedeemed', 'ownerOf', 'tokenURI']) {
  requirePattern(reconcile, new RegExp(truth), `链上成功真值缺少 ${truth}`);
}
forbidPattern(reconcile, /decodeFunctionData|transaction\.to/,
  '对账不得假设外层交易直接调用 ScoreNFT');

const submission = read('app/api/self-mint/submission/route.ts');
requirePattern(submission, /submit_score_self_mint_transaction/,
  'submission 必须只登记哈希并交给统一状态机');
forbidPattern(submission, /getTransaction|getTransactionReceipt|status:\s*['"]success/,
  'submission 不得凭客户端哈希或即时 RPC 判定成功');

const snapshot = read('src/lib/self-mint/snapshot.ts');
requirePattern(snapshot, /publish_score_playback_snapshot/,
  '链上成功后必须发布 P15 verified snapshot');
requirePattern(snapshot, /p_chain_id: row\.chain_id[\s\S]*p_contract:[\s\S]*p_token_id:/,
  'snapshot 必须使用完整多链资产身份');

console.log('P16 钱包单路径、orderId 恢复与 verified snapshot 策略通过');
