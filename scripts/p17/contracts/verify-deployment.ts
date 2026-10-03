import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { balanceForPlan, makeDeploymentPlan, type DeploymentInput } from './deployment-plan';
import { withDeploymentLedger } from './deployment-ledger';
import { runDeployment, type DeploymentAdapter } from './deployment-inspect';
const address = (id: number) => `0x${id.toString(16).padStart(40, '0')}` as `0x${string}`;
const input: DeploymentInput = { kind:'ethereum', chainId:31337, sender:address(4), admin:address(1),
  issuer:address(2), pauser:address(3), collectionUri:'ar://'+'A'.repeat(43),
  catalogRevision:'test-local', policyRef:'本地测试，非生产', authorizationRef:'本地测试',
  tokenIds:Array.from({length:35},(_,i)=>String(i+1)), uris:Array(35).fill('ar://'+'B'.repeat(43)),
  sourceHash:'0x'+'11'.repeat(32), bytecode:'0x6000', abi:[{type:'constructor',stateMutability:'nonpayable',
    inputs:['uint256[35]','string[35]','string','address','address','address'].map(type=>({type}))}], nonce:0, gasLimit:'100',
  maxFeePerGas:'2', maxPriorityFeePerGas:'1', maxCostWei:'200', balanceWei:'200', confirmations:1 };
const plan = makeDeploymentPlan(input);
assert.equal(balanceForPlan('--inspect','submitted','1','200'),'200');
assert.equal(balanceForPlan('--execute','unknown','1','200'),'200');
assert.equal(balanceForPlan('--execute','planned','1','200'),'1');
assert.equal(plan.planHash, makeDeploymentPlan({...input}).planHash);
for (const bad of [{issuer:input.admin},{collectionUri:''},{uris:input.uris.slice(1)},
  {chainId:10},{maxCostWei:'199'},{balanceWei:'199'},{gasLimit:'0'},{authorizationRef:''}]) {
  assert.throws(()=>makeDeploymentPlan({...input,...bad}));
}
assert.notEqual(plan.planHash, makeDeploymentPlan({...input,nonce:1}).planHash);
const opInput:DeploymentInput={...input,kind:'optimism',chainId:10,sender:input.issuer};
// 仅编码公开夹具，真实网络不会发送；OP运营钱包同时部署与MINTER是已授权路径。
assert.doesNotThrow(()=>makeDeploymentPlan(opInput));
for(const sender of [input.admin,input.pauser])assert.throws(()=>makeDeploymentPlan({...opInput,sender}));
assert.throws(()=>makeDeploymentPlan({...input,chainId:1,sender:input.issuer}));
assert.doesNotThrow(()=>makeDeploymentPlan({...input,chainId:1,
  sender:'0x306D3A445b1fc7a789639fa9115e308a34231633',
  admin:'0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722',
  issuer:'0xAb14FeFDFBedC67176E1ea6D6461Ad9F07bDe73a',
  pauser:'0x910380D1C8ad89f9ABf953460044d7b979883194'}));
const dir = mkdtempSync(join(tmpdir(),'ripples-p17-deploy-'));
const file = join(dir,'ledger.json');
let sends=0, inspected=0;
const txHash='0x'+'22'.repeat(32) as `0x${string}`;
const adapter: DeploymentAdapter = {
  async inspect() { inspected++; return {address:address(9),blockNumber:'1',blockHash:txHash}; },
  async sign() { return {hash:txHash,raw:'0x1234'}; },
  async send() {
    const before=JSON.parse(readFileSync(file,'utf8'));
    assert.equal(before.state,'attempted'); assert.equal(before.txHash,txHash);
    sends++; throw new Error('网络结果未知');
  },
};
async function main() {
  try {
    await withDeploymentLedger(file, plan, (saved,persist)=>runDeployment(plan,saved,adapter,true,persist));
    const unknown=JSON.parse(readFileSync(file,'utf8'));
    assert.equal(unknown.state,'unknown'); assert.equal(unknown.txHash,txHash); assert.equal(sends,1);
    await withDeploymentLedger(file, plan, (saved,persist)=>runDeployment(plan,saved,adapter,true,persist));
    assert.equal(sends,1); assert.equal(inspected,1);
    await withDeploymentLedger(file, plan, (saved,persist)=>runDeployment(plan,saved,adapter,true,persist));
    assert.equal(sends,1); assert.equal(inspected,2);
    await assert.rejects(runDeployment(plan,{...unknown,state:'planned',txHash:null},adapter,true,()=>{throw new Error('磁盘不可写');}));
    assert.equal(sends,1);
    await assert.rejects(withDeploymentLedger(file,makeDeploymentPlan({...input,nonce:1}),async()=>{}));
    console.log('P17部署：计划/角色/URI/链/预算拒绝，发送前持久化，unknown只核验，确认后幂等通过');
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
void main().catch(()=>{console.error('P17部署验证失败');process.exitCode=1;});
