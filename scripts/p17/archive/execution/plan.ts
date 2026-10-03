import { createHash } from 'node:crypto';
import { getAddress, zeroAddress, type Hex } from 'viem';
import type { MusicCatalog } from '../../../../src/lib/music-catalog/types';
import { createArchivePlan } from '../plan';
import type { ExecutionConfig, ExecutionPlan, ExecutionChain } from './types';

export function transactionCost(chain: ExecutionChain): bigint {
  return BigInt(chain.gasLimit) * BigInt(chain.maxFeePerGas) + BigInt(chain.l1FeeCapWei);
}
export function createExecutionPlan(catalog: MusicCatalog, input: ExecutionConfig): ExecutionPlan {
  const fields = ['runId','sourceSha','recipient','approvalRef','chains','recipientKeyEnv','opSenderKeyEnv','authorizerKeyEnv'];
  if (Object.keys(input).some(field => !fields.includes(field))) throw Error('公开配置不能携带额外字段或签名秘密');
  const config = structuredClone(input);
  for (const name of [config.recipientKeyEnv, config.opSenderKeyEnv, config.authorizerKeyEnv]) {
    if (name !== undefined && !/^[A-Z][A-Z0-9_]*$/.test(name)) throw Error('只允许登记密钥环境变量名');
  }
  config.recipient = getAddress(config.recipient);
  if (config.recipient === zeroAddress || !config.approvalRef.trim() || config.chains.length !== 2
    || new Set(config.chains.map(chain => chain.chainId)).size !== 2) throw Error('明确接收地址、授权依据及双链配置缺失');
  for (const chain of config.chains) {
    if (Object.keys(chain).some(field => !['chainId','sender','nonce','gasLimit','maxFeePerGas',
      'maxPriorityFeePerGas','l1FeeCapWei','budgetWei','confirmations','rpcEnv'].includes(field))) throw Error('链配置包含未授权字段');
    chain.sender = getAddress(chain.sender);
    if (![1, 10].includes(chain.chainId) || chain.sender === zeroAddress
      || (chain.chainId === 1 && chain.sender !== config.recipient)
      || !Number.isSafeInteger(chain.nonce) || chain.nonce < 0
      || !Number.isSafeInteger(chain.confirmations) || chain.confirmations < 1
      || !/^[A-Z][A-Z0-9_]*$/.test(chain.rpcEnv)) throw Error('发送身份、nonce、确认数或RPC变量配置无效');
    for (const field of ['gasLimit','maxFeePerGas','maxPriorityFeePerGas','l1FeeCapWei','budgetWei'] as const) {
      if (!/^(0|[1-9][0-9]*)$/.test(chain[field])) throw Error('费用须为明确非负整数Wei');
    }
    if (BigInt(chain.gasLimit) < 21000n || BigInt(chain.maxFeePerGas) < 1n
      || BigInt(chain.maxPriorityFeePerGas) > BigInt(chain.maxFeePerGas)
      || (chain.chainId === 1 && chain.l1FeeCapWei !== '0')
      || transactionCost(chain) * 35n > BigInt(chain.budgetWei)) throw Error('35项最大费用超过冻结预算');
  }
  const recipients = { 1: { address: config.recipient, approvalRef: config.approvalRef },
    10: { address: config.recipient, approvalRef: config.approvalRef } };
  const archive = createArchivePlan(catalog, { runId: config.runId, sourceSha: config.sourceSha, recipients });
  const content = { schemaVersion: 1 as const, archive, config };
  const planHash: Hex = `0x${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`;
  return { ...content, planHash };
}
