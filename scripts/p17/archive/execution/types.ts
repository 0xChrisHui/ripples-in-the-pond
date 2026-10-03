import type { Address, Hex } from 'viem';
import type { ArchiveItem, ArchivePlan } from '../types';

export type ExecutionChain = {
  chainId: 1 | 10; sender: Address; nonce: number; gasLimit: string; maxFeePerGas: string;
  maxPriorityFeePerGas: string; l1FeeCapWei: string; budgetWei: string; confirmations: number; rpcEnv: string;
};
export type ExecutionConfig = {
  runId: string; sourceSha: string; recipient: Address; approvalRef: string; chains: ExecutionChain[];
  recipientKeyEnv?: string; opSenderKeyEnv?: string; authorizerKeyEnv?: string;
  fundingMode?: 'per_transaction';
};
export type ExecutionPlan = { schemaVersion: 1; planHash: Hex; archive: ArchivePlan; config: ExecutionConfig };
export type ExecutionAttempt = {
  operationId: Hex; chainId: 1 | 10; sender: Address; nonce: number; raw: Hex; hash: Hex; calldataHash: Hex;
  authorization?: { digest: Hex; deadline: number; authorizer: Address }; attemptedAt: string;
};
export type ExecutionLedger = ArchivePlan & {
  execution: { plan: ExecutionPlan; attempts: Record<string, ExecutionAttempt> };
};
export type PersistExecution = (ledger: ExecutionLedger) => Promise<void>;
export type ExecutionAdapter = {
  chainId: () => Promise<number>; validate: (item: ArchiveItem) => Promise<void>;
  balance: (sender: Address) => Promise<bigint>; nonce: (sender: Address) => Promise<number>;
  inspect: (item: ArchiveItem, attempt?: ExecutionAttempt) => Promise<ArchiveItem>;
  sign: (item: ArchiveItem, chain: ExecutionChain, nonce: number) => Promise<Omit<ExecutionAttempt,
    'operationId' | 'chainId' | 'sender' | 'nonce' | 'attemptedAt'>>;
  send: (raw: Hex) => Promise<Hex>; assertLease: () => Promise<void>;
};
