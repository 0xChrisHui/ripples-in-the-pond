import type { Address, Hex } from 'viem';
import type { DeploymentPlan } from './deployment-plan';
import type { DeploymentLedger, PersistDeployment } from './deployment-ledger';
export type DeploymentProof={address:Address; blockNumber:string; blockHash:Hex};
export type DeploymentAdapter={
  inspect:(plan:DeploymentPlan,ledger:DeploymentLedger)=>Promise<DeploymentProof|null>;
  sign:(plan:DeploymentPlan)=>Promise<{hash:Hex;raw:Hex}>;
  send:(raw:Hex)=>Promise<Hex>;
};
export async function runDeployment(plan:DeploymentPlan, ledger:DeploymentLedger, adapter:DeploymentAdapter,
  execute:boolean, persist:PersistDeployment):Promise<DeploymentLedger> {
  if (ledger.state!=='planned') {
    const proof=await adapter.inspect(plan,ledger);
    const next:DeploymentLedger=proof?{...ledger,state:'confirmed',contractAddress:proof.address,
      blockNumber:proof.blockNumber,blockHash:proof.blockHash,checkedAt:new Date().toISOString()}:
      {...ledger,state:'unknown',checkedAt:new Date().toISOString()};
    persist(next); return next;
  }
  if(!execute)return ledger;
  const signed=await adapter.sign(plan);
  const attempt:DeploymentLedger={...ledger,state:'attempted',txHash:signed.hash,attemptedAt:new Date().toISOString()};
  persist(attempt);
  try {
    const hash=await adapter.send(signed.raw);
    if(hash!==signed.hash)throw new Error('广播返回的哈希与签名交易不同');
    const submitted:DeploymentLedger={...attempt,state:'submitted'}; persist(submitted); return submitted;
  } catch {
    const unknown:DeploymentLedger={...attempt,state:'unknown'}; persist(unknown); return unknown;
  }
}
