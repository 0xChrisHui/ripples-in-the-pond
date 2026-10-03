import '../../../_env';
import { existsSync, readFileSync } from 'node:fs';
import { getMusicCatalog } from '../../../../src/lib/music-catalog/asset-registry';
import { createExecutionPlan } from './plan';
import { withExecutionLedger } from './ledger';
import { createExecutionAdapter } from './adapter';
import { acquireExecutionLease } from './lock';
import { runArchiveExecution } from './engine';
import type { ExecutionConfig } from './types';

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('默认只读。用法：cli.ts --plan|--inspect|--execute <公开配置JSON> <账本JSON> [1|10] [已冻结planHash]；execute每轮最多一笔。');
    return;
  }
  const [mode, configFile, ledgerFile, chainText, approvedHash, ...extra] = args;
  if (!['--plan','--inspect','--execute'].includes(mode) || !configFile || !ledgerFile || extra.length
    || (mode === '--plan' && (chainText || approvedHash))
    || (mode !== '--plan' && !['1','10'].includes(chainText))
    || (mode === '--inspect' && approvedHash)) throw Error('执行参数无效，发送须显式chain及冻结planHash');
  const plan = createExecutionPlan(getMusicCatalog(), JSON.parse(readFileSync(configFile, 'utf8')) as ExecutionConfig);
  const config = plan.config;
  if (mode === '--execute' && approvedHash !== plan.planHash) throw Error('显式执行hash与冻结计划不符');
  if (mode !== '--plan' && !existsSync(ledgerFile)) throw Error('须先使用--plan登记完整冻结账本');
  const lease = mode === '--execute' ? await acquireExecutionLease(plan.planHash) : null;
  try {
    const result = await withExecutionLedger(ledgerFile, plan, async (ledger, persist) => {
      if (mode === '--plan') return ledger;
      const chainId = Number(chainText) as 1 | 10, chain = config.chains.find(value => value.chainId === chainId)!;
      const adapter = createExecutionAdapter(config, chain, lease?.assertLease ?? (async () => { throw Error('只读模式禁止发送'); }));
      return runArchiveExecution(plan, ledger, adapter, chainId, mode === '--execute', persist);
    });
    console.log(JSON.stringify({ mode, planHash: plan.planHash, total: result.items.length,
      confirmed: result.items.filter(item => item.state === 'confirmed').length,
      unknown: result.items.filter(item => item.state === 'unknown').length,
      next: result.items.filter(item => !chainText || item.chainId === Number(chainText)).find(item => item.state !== 'confirmed')?.state ?? 'confirmed',
      transactions: Object.values(result.execution.attempts).map(attempt => ({ chainId: attempt.chainId, nonce: attempt.nonce, hash: attempt.hash })) }));
  } finally { await lease?.release(); }
}
void main().catch(error => {
  // viem/RPC异常可能包含请求体、签名原文或付费URL；不输出嵌套错误。
  console.error('留存执行停止，已有nonce/hash保留：', error instanceof Error && error.constructor === Error ? error.message : '外部或持久层错误');
  process.exitCode = 1;
});
