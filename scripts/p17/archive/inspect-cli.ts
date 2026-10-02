import { readFileSync } from 'node:fs';
import { getAddress } from 'viem';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { createArchivePlan } from './plan';
import { updateArchiveLedger } from './ledger';
import { createArchiveReader } from './inspect';
import type { ArchiveRecipient } from './types';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('只读核验：--ledger <本地账本> --chain <10或1> --rpc-url <明确RPC>；不支持execute，不读取私钥。');
    return;
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--ledger','--chain','--rpc-url'].includes(args[i]) || !args[i+1] || flags.has(args[i])) {
      throw new Error('核验参数无效；不能发送交易或猜接收地址');
    }
    flags.set(args[i], args[i+1]);
  }
  const file = flags.get('--ledger'), chainId = Number(flags.get('--chain')), rpc = flags.get('--rpc-url');
  if (!file || !rpc || (chainId !== 10 && chainId !== 1)) throw new Error('账本、链和只读RPC须明确提供');
  const saved: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!record(saved) || saved.schemaVersion !== 2 || typeof saved.runId !== 'string'
    || typeof saved.sourceSha !== 'string' || !Array.isArray(saved.items)) throw new Error('请先生成完整本地留存账本');
  const recipients: Partial<Record<1 | 10, ArchiveRecipient>> = {};
  for (const item of saved.items) {
    if (!record(item) || (item.chainId !== 1 && item.chainId !== 10)) throw new Error('账本坐标无效');
    if (item.recipient == null) continue;
    if (typeof item.recipient !== 'string' || typeof item.approvalRef !== 'string') throw new Error('接收地址缺少记录依据');
    const input = { address: getAddress(item.recipient), approvalRef: item.approvalRef };
    const previous = recipients[item.chainId];
    if (previous && (previous.address !== input.address || previous.approvalRef !== input.approvalRef)) {
      throw new Error('同链接收输入冲突，禁止猜测');
    }
    recipients[item.chainId] = input;
  }
  const plan = createArchivePlan(getMusicCatalog(), { runId: saved.runId, sourceSha: saved.sourceSha, recipients });
  const reader = createArchiveReader(chainId, rpc);
  const ledger = await updateArchiveLedger(file, plan, async current => {
    const items = [];
    for (const item of current.items) items.push(item.chainId === chainId ? await reader.inspect(item) : item);
    return { ...current, items };
  });
  console.log(`只读核验完成：${ledger.items.length}项，外部发送0；仅依据本次完整mint/余额证明更新状态。`);
}
void main().catch(error => {
  // RPC异常可能包含付费endpoint参数；只输出错误种类，不泄露URL或凭证。
  console.error('只读核验未完成，旧账本保留：', error instanceof Error ? error.name : '未知错误');
  process.exitCode = 1;
});
