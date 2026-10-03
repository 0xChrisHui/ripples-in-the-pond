import '../../_env';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, getAddress, http, keccak256, parseAbi, stringToHex, type Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Redis } from '@upstash/redis';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import metadata from '../../../src/lib/music-catalog/data/metadata-source.json';
import { makeDeploymentPlan, type DeploymentInput, type DeploymentPlan } from './deployment-plan';
import { withDeploymentLedger } from './deployment-ledger';
import { runDeployment, type DeploymentAdapter } from './deployment-inspect';
type Artifact={abi:Abi;bytecode:{object:Hex};deployedBytecode:{object:Hex;immutableReferences?:Record<string,{start:number;length:number}[]>};rawMetadata?:string};
const oracleAbi=parseAbi(['function getL1Fee(bytes) view returns (uint256)']);
function normalized(code:Hex, artifact:Artifact):string {
  const bytes=Buffer.from(code.slice(2),'hex');
  for(const spans of Object.values(artifact.deployedBytecode.immutableReferences??{})) {
    for(const span of spans)bytes.fill(0,span.start,span.start+span.length);
  }
  return bytes.toString('hex');
}
async function main() {
  const [mode,configFile,ledgerFile,...extra]=process.argv.slice(2);
  if(!['--plan','--inspect','--execute'].includes(mode)||!configFile||!ledgerFile||extra.length) {
    throw new Error('用法：deployment-cli.ts --plan|--inspect|--execute <公开配置JSON> <部署账本JSON>');
  }
  const config=JSON.parse(readFileSync(configFile,'utf8')) as Omit<DeploymentInput,'bytecode'|'abi'|'balanceWei'|'tokenIds'|'uris'|'sourceHash'|'sender'> &
    {rpcEnv:string;privateKeyEnv?:string;expectedPlanHash?:Hex;executionLeaseRef?:string};
  const rpc=process.env[config.rpcEnv]; if(!rpc)throw new Error('指定RPC未配置');
  const key=process.env[config.privateKeyEnv??'DEPLOYER_PRIVATE_KEY'] as Hex|undefined;
  if(!key)throw new Error('指定部署签名私钥未配置');
  const account=privateKeyToAccount(key);
  const client=createPublicClient({transport:http(rpc,{timeout:20000,retryCount:0})});
  if(await client.getChainId()!==config.chainId)throw new Error('实际RPC链与计划不匹配');
  const name=config.kind==='ethereum'?'EthereumMaterialNFT':'OptimismOriginalSBT';
  const artifact=JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8')) as Artifact;
  if(!artifact.rawMetadata)throw new Error('artifact缺少可核对的编译metadata');
  const compilerMetadata=JSON.parse(artifact.rawMetadata) as {sources:Record<string,{keccak256:Hex}>};
  for(const [path,proof] of Object.entries(compilerMetadata.sources)) {
    // Forge在Windows读取源码时统一换行；按编译器实际输入比较。
    if(path.includes('..')||keccak256(stringToHex(readFileSync(`contracts/${path}`,'utf8').replace(/\r\n/g,'\n')))!==proof.keccak256) {
      throw new Error('artifact与现有源码不一致，须重新编译');
    }
  }
  const catalog=getMusicCatalog(), tracks=[...catalog.tracks].sort((a,b)=>a.displayNumber-b.displayNumber);
  const uris=tracks.map(track=>{
    const item=metadata.find(row=>row.tokenId===String(track.displayNumber));
    if(!item||! /^[0-9a-f]{64}$/i.test(item.uploadedMetadataSha256))throw new Error('缺少既有永久metadata证明');
    return `ar://${item.txId}`;
  });
  if(config.catalogRevision!==catalog.revision)throw new Error('配置revision与唯一注册表不一致');
  const source=createHash('sha256').update(readFileSync(`contracts/src/p17/${name}.sol`))
    .update(readFileSync('contracts/src/p17/OriginalMetadata.sol')).update(readFileSync('contracts/foundry.toml'))
    .update(artifact.rawMetadata??'').digest('hex');
  const {rpcEnv:_rpc,privateKeyEnv:_key,expectedPlanHash:_expected,executionLeaseRef:_lease,...publicConfig}=config;
  void _rpc; void _key; void _expected; void _lease;
  const input={...publicConfig,sender:account.address,sourceHash:`0x${source}`,abi:artifact.abi,bytecode:artifact.bytecode.object,
    tokenIds:tracks.map(track=>String(track.displayNumber)),uris,balanceWei:String(await client.getBalance({address:account.address}))};
  const plan=makeDeploymentPlan(input);
  if(mode==='--execute'&&config.expectedPlanHash!==plan.planHash)throw new Error('execute必须与登记计划hash完全一致');
  if(mode==='--execute'&&!config.executionLeaseRef?.trim())throw new Error('execute缺少总控独占写入租约记录');
  let estimatedGas:string|null=null;
  if(mode==='--plan') {
    estimatedGas=String(await client.estimateGas({account,data:plan.data}));
    if(BigInt(estimatedGas)>BigInt(plan.gasLimit))throw new Error('实际部署估算超过Gas上限');
    const pending=await client.getTransactionCount({address:account.address,blockTag:'pending'});
    const latest=await client.getTransactionCount({address:account.address});
    if(pending!==plan.nonce||latest!==pending)throw new Error('计划nonce不匹配或已有在途交易');
  }
  const adapter:DeploymentAdapter={
    async inspect(expected,ledger) {
      if(!ledger.txHash)return null;
      let receipt;
      try {receipt=await client.getTransactionReceipt({hash:ledger.txHash});}
      catch(error) {if(error instanceof Error&&error.name==='TransactionReceiptNotFoundError')return null;throw error;}
      if(receipt.status!=='success'||!receipt.contractAddress)throw new Error('部署回执失败或缺少地址，禁止重发');
      const tx=await client.getTransaction({hash:ledger.txHash});
      if(tx.to!==null||getAddress(tx.from)!==expected.sender||tx.nonce!==expected.nonce||tx.input!==expected.data)throw new Error('部署交易身份不匹配');
      const head=await client.getBlockNumber(),block=await client.getBlock({blockNumber:receipt.blockNumber});
      if(block.hash!==receipt.blockHash||head-receipt.blockNumber+1n<BigInt(expected.confirmations))return null;
      await verifyContract(expected,receipt.contractAddress);
      return {address:receipt.contractAddress,blockNumber:String(receipt.blockNumber),blockHash:receipt.blockHash};
    },
    async sign(expected) {
      const nonce=await client.getTransactionCount({address:account.address,blockTag:'pending'});
      const latest=await client.getTransactionCount({address:account.address});
      if(nonce!==expected.nonce||nonce!==latest)throw new Error('nonce改变或已有在途交易，先核验');
      const balance=await client.getBalance({address:account.address});
      if(balance<BigInt(expected.maxCostWei))throw new Error('最新余额低于计划最大支出');
      const estimate=await client.estimateGas({account,data:expected.data});
      if(estimate>BigInt(expected.gasLimit))throw new Error('部署Gas估算超过冻结上限');
      const raw=await account.signTransaction({chainId:expected.chainId,nonce:expected.nonce,data:expected.data,
        gas:BigInt(expected.gasLimit),maxFeePerGas:BigInt(expected.maxFeePerGas),
        maxPriorityFeePerGas:BigInt(expected.maxPriorityFeePerGas),value:0n,type:'eip1559'});
      if(expected.kind==='optimism'&&expected.chainId!==31337) {
        const fee=await client.readContract({address:'0x420000000000000000000000000000000000000F',abi:oracleAbi,functionName:'getL1Fee',args:[raw]});
        if(fee>BigInt(expected.l1FeeCapWei??'0'))throw new Error('OP实际L1费用超过冻结预留');
      }
      return {raw,hash:keccak256(raw)};
    },
    async send(raw) {return createWalletClient({transport:http(rpc,{retryCount:0})}).sendRawTransaction({serializedTransaction:raw});},
  };
  async function verifyContract(expected:DeploymentPlan,address:`0x${string}`) {
    const code=await client.getCode({address});
    if(!code||normalized(code,artifact)!==normalized(artifact.deployedBytecode.object,artifact))throw new Error('部署runtime与编译字节码不匹配');
    const read=(functionName:string,args?:unknown[])=>client.readContract({address,abi:artifact.abi,functionName,args});
    const issuerRole=await read(config.kind==='ethereum'?'AUTHORIZER_ROLE':'MINTER_ROLE') as Hex;
    const pauserRole=await read('PAUSER_ROLE') as Hex;
    if(getAddress(await read('defaultAdmin') as string)!==expected.admin||BigInt(await read('defaultAdminDelay') as number)!==172800n
      ||await read('contractURI')!==expected.collectionUri||await read('paused')!==false
      ||await read('hasRole',[issuerRole,expected.issuer])!==true||await read('hasRole',[pauserRole,expected.pauser])!==true
      ||await read('supportsInterface',['0xd9b67a26'])!==true)throw new Error('部署角色、URI或接口不匹配');
    for(let i=0;i<35;i++)if(await read('uri',[BigInt(expected.tokenIds[i])])!==expected.uris[i])throw new Error('35URI读回不匹配');
    if(config.kind==='optimism'&&await read('isSoulbound')!==true)throw new Error('OP不是新SBT');
  }
  let redis:Redis|null=null;
  const holder=`p17-deploy:${plan.planHash}`;
  let timer:ReturnType<typeof setInterval>|null=null,leaseValid=true;
  if(mode==='--execute'&&config.chainId!==31337) {
    const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
    if(!url||!token)throw new Error('真实发送拒绝fallback锁');
    redis=new Redis({url,token});
    if(await redis.set('op_wallet_lock',holder,{nx:true,px:120000})!=='OK')throw new Error('共享运营发送锁忙');
    timer=setInterval(()=>{void redis!.eval('if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE",KEYS[1],120000) else return 0 end',
      ['op_wallet_lock'],[holder]).then(value=>{if(value!==1)leaseValid=false;}).catch(()=>{leaseValid=false;});},30000);
  }
  try {
    const guarded={...adapter,send:async(raw:Hex)=>{if(!leaseValid)throw new Error('共享租约失效');return adapter.send(raw);}};
    const saved=await withDeploymentLedger(ledgerFile,plan,(ledger,persist)=>runDeployment(plan,ledger,guarded,mode==='--execute',persist));
  console.log(JSON.stringify({mode,planHash:plan.planHash,chainId:plan.chainId,sender:plan.sender,nonce:plan.nonce,
    state:saved.state,maxCostWei:plan.maxCostWei,estimatedGas,txHash:saved.txHash,contractAddress:saved.contractAddress}));
  } finally {
    if(timer)clearInterval(timer);
    if(redis)await redis.eval('if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',
      ['op_wallet_lock'],[holder]);
  }
}
void main().catch(error=>{
  console.error('部署工具停止：',error instanceof Error?(error.constructor===Error?error.message:error.name):'未知错误');
  process.exitCode=1;
});
