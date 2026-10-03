import { createHash } from 'node:crypto';
import { encodeDeployData, getAddress, isAddress, keccak256, type Abi, type Address, type Hex } from 'viem';
export type DeploymentInput = {
  kind:'ethereum'|'optimism'; chainId:number; sender:Address; admin:Address; issuer:Address; pauser:Address;
  collectionUri:string; catalogRevision:string; policyRef:string; authorizationRef:string;
  tokenIds:string[]; uris:string[]; sourceHash:string; bytecode:Hex; abi:Abi; nonce:number;
  gasLimit:string; maxFeePerGas:string; maxPriorityFeePerGas:string; maxCostWei:string; balanceWei:string;
  confirmations:number; l1FeeCapWei?:string;
};
export type DeploymentPlan = Omit<DeploymentInput,'bytecode'|'abi'|'balanceWei'> & {
  bytecodeHash:Hex; constructorHash:Hex; data:Hex; planHash:Hex;
};
export function balanceForPlan(mode:string,state:string|undefined,actual:string,maxCost:string):string {
  return mode==='--inspect'||(state!==undefined&&state!=='planned')?maxCost:actual;
}
function digest(value:unknown): Hex { return `0x${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
export function makeDeploymentPlan(input:DeploymentInput): DeploymentPlan {
  if(!['ethereum','optimism'].includes(input.kind))throw new Error('未知部署类型');
  const expected=input.kind==='ethereum'?[1,11155111,31337]:[10,11155420,31337];
  if (!expected.includes(input.chainId)) throw new Error('合约与网络不匹配');
  const roles=[input.admin,input.issuer,input.pauser];
  if ([input.sender,...roles].some(value=>!isAddress(value)||/^0x0{40}$/i.test(value))
    || new Set(roles.map(value=>value.toLowerCase())).size!==3) throw new Error('三角色必须非零且独立');
  const separated=input.kind==='ethereum'?roles:[input.admin,input.pauser];
  if ([1,10].includes(input.chainId)&&separated.some(value=>value.toLowerCase()===input.sender.toLowerCase())) {
    throw new Error('部署钱包与受保护长期角色冲突');
  }
  if (!/^ar:\/\/[A-Za-z0-9_-]{43}$/.test(input.collectionUri)
    || input.uris.length!==35 || input.uris.some(uri=>!/^ar:\/\/[A-Za-z0-9_-]{43}$/.test(uri))) throw new Error('缺少35永久URI或系列URI');
  if (input.tokenIds.length!==35 || new Set(input.tokenIds).size!==35
    || input.tokenIds.some(id=>!/^\d+$/.test(id)||BigInt(id)<=0n)) throw new Error('必须固定35个唯一正编号');
  if (![input.catalogRevision,input.policyRef,input.authorizationRef].every(value=>typeof value==='string'&&value.trim())
    || !/^0x[0-9a-f]{64}$/i.test(input.sourceHash) || !/^0x(?:[0-9a-f]{2})+$/i.test(input.bytecode)) throw new Error('缺少授权、源码或字节码');
  const integers=[input.gasLimit,input.maxFeePerGas,input.maxPriorityFeePerGas,input.maxCostWei,input.balanceWei,input.l1FeeCapWei??'0'];
  if (integers.some(value=>!/^\d+$/.test(value)) || !Number.isSafeInteger(input.nonce)||input.nonce<0
    || !Number.isSafeInteger(input.confirmations)||input.confirmations<1) throw new Error('费用/nonce/确认数无效');
  const cost=BigInt(input.gasLimit)*BigInt(input.maxFeePerGas)+BigInt(input.l1FeeCapWei??'0');
  if (BigInt(input.gasLimit)<=0n || BigInt(input.maxFeePerGas)<=0n
    || BigInt(input.maxPriorityFeePerGas)>BigInt(input.maxFeePerGas)
    || cost>BigInt(input.maxCostWei)||cost>BigInt(input.balanceWei)) throw new Error('费用超过批准边界或余额');
  const data=encodeDeployData({abi:input.abi,bytecode:input.bytecode,args:[input.tokenIds.map(BigInt),input.uris,
    input.collectionUri,...roles.map(value=>getAddress(value))]});
  const {bytecode,abi: _abi,balanceWei: _balance,...fields}=input;
  void _abi; void _balance;
  const payload={...fields,sender:getAddress(input.sender),admin:getAddress(input.admin),issuer:getAddress(input.issuer),
    pauser:getAddress(input.pauser),bytecodeHash:keccak256(bytecode),constructorHash:keccak256(data),data};
  return {...payload,planHash:digest(payload)};
}
