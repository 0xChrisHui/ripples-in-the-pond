import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Address, Hex } from 'viem';
import type { DeploymentPlan } from './deployment-plan';
export type DeploymentLedger = {
  schemaVersion:1; plan:DeploymentPlan; state:'planned'|'attempted'|'submitted'|'unknown'|'confirmed'|'failed';
  txHash:Hex|null; contractAddress:Address|null; blockNumber:string|null; blockHash:Hex|null;
  attemptedAt:string|null; checkedAt:string|null;
};
export type PersistDeployment = (value:DeploymentLedger)=>void;
export async function withDeploymentLedger<T>(file:string, plan:DeploymentPlan,
  action:(ledger:DeploymentLedger,persist:PersistDeployment)=>Promise<T>):Promise<T> {
  mkdirSync(dirname(file),{recursive:true}); const lock=`${file}.lock`; const fd=openSync(lock,'wx');
  const temp=`${file}.${process.pid}.tmp`;
  function persist(value:DeploymentLedger) {
    const out=openSync(temp,'wx');
    try { writeFileSync(out,JSON.stringify(value,null,2)+'\n'); fsyncSync(out); } finally { closeSync(out); }
    renameSync(temp,file);
  }
  try {
    const ledger:DeploymentLedger=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{schemaVersion:1,plan,
      state:'planned',txHash:null,contractAddress:null,blockNumber:null,blockHash:null,attemptedAt:null,checkedAt:null};
    if (ledger.schemaVersion!==1||ledger.plan?.planHash!==plan.planHash
      || JSON.stringify(ledger.plan)!==JSON.stringify(plan)
      || !['planned','attempted','submitted','unknown','confirmed','failed'].includes(ledger.state)
      || (ledger.txHash!==null&&!/^0x[0-9a-f]{64}$/i.test(ledger.txHash))
      || (ledger.state!=='planned'&&ledger.txHash===null)) throw new Error('旧部署账本不匹配，禁止覆盖或新建部署');
    persist(ledger); return await action(ledger,persist);
  } finally { if(existsSync(temp))unlinkSync(temp); closeSync(fd); unlinkSync(lock); }
}
