import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, stringToHex, getAddress, type Hex, type Abi } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { buildMaterialTypedData, hashMaterialAuthorization, MATERIAL_ABI } from '../../../src/lib/material-mint/contract';
import { inspectMaterialOrder } from '../../../src/lib/material-mint/inspect';
import type { MaterialOrder, MaterialAttempt } from '../../../src/lib/material-mint/types';

async function main() {
  // Anvil公开开发密钥只用于明确31337隔离测试，不读取环境或生产账户。
  const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const signer = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
  const rpc = http('http://127.0.0.1:8547');
  const client = createPublicClient({ chain: foundry, transport: rpc });
  assert.equal(await client.getChainId(), 31337);
  const wallet = createWalletClient({ account, chain: foundry, transport: rpc });
  const artifact = JSON.parse(readFileSync('contracts/out/MaterialTestBase.sol/BoundedMaterialHarness.json','utf8')) as { abi: Abi; bytecode:{object:Hex} };
  const uri = 'ar://' + 'T'.repeat(43);
  const deployment = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object,
    args: [Array.from({length:35},(_,i)=>BigInt(i+1)),Array.from({length:35},()=>uri),getAddress('0x000000000000000000000000000000000000ad11'),
      signer.address,getAddress('0x000000000000000000000000000000000000fa05')] });
  const deployed = await client.waitForTransactionReceipt({ hash: deployment });
  const address = deployed.contractAddress; assert.ok(address);
  const authorization = { orderId: keccak256(stringToHex('p17-local-20261002-night-01')),tokenId:1n,amount:1n,
    recipient:account.address,tokenURIHash:keccak256(stringToHex(uri)),deadline:(await client.getBlock()).timestamp+900n };
  const signature = await signer.signTypedData(buildMaterialTypedData(31337,address,authorization));
  const digest = hashMaterialAuthorization(31337,address,authorization);
  const snapshotResponse=await fetch('http://127.0.0.1:8547',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'evm_snapshot',params:[]})});
  const snapshot=(await snapshotResponse.json() as {result:string}).result;
  const hash = await wallet.writeContract({address,abi:MATERIAL_ABI,functionName:'redeem',args:[authorization,signer.address,signature]});
  const receipt = await client.waitForTransactionReceipt({hash});
  const row = { order_id:authorization.orderId,user_id:'explicit-local-fixture',request_key:'local-fixture',track_id:'explicit-local-fixture',
    chain_id:31337,contract_address:address,token_id:'1',recipient_address:account.address,amount:1,catalog_revision:'local-fixture',metadata_uri:uri,
    uri_hash:authorization.tokenURIHash,status:'submitted',version:0,current_digest:digest,tx_hash:hash,
    confirmed_block:null,confirmed_block_hash:null,confirmed_log_index:null,lease_owner:null,lease_until:null,error_kind:null } as unknown as MaterialOrder;
  const attempt:MaterialAttempt = {order_id:row.order_id,digest,deadline:Number(authorization.deadline),authorizer:signer.address,
    send_attempted_at:'2026-10-02T00:00:00Z',outcome:'submitted',tx_hashes:[hash]};
  const inspect = (order:MaterialOrder, history:MaterialAttempt[]) => inspectMaterialOrder(client,order,history,
    {fromBlock:deployed.blockNumber,requiredConfirmations:1});
  const result = await inspect(row,[attempt]); assert.equal(result.state,'success');
  const recovered = await inspect({...row,status:'unknown',tx_hash:null},[{...attempt,tx_hashes:[]}]);
  assert.equal(recovered.state,'success');
  assert.equal((await inspect({...row,status:'unknown',tx_hash:null},[{...attempt,send_attempted_at:null,outcome:'rejected',tx_hashes:[]}])).state,'success');
  const malformed = {...row,recipient_address:signer.address};
  await assert.rejects(inspect(malformed,[attempt]));
  const transferAbi = [{type:'function',name:'safeTransferFrom',stateMutability:'nonpayable',inputs:[{type:'address',name:'from'},
    {type:'address',name:'to'},{type:'uint256',name:'id'},{type:'uint256',name:'amount'},{type:'bytes',name:'data'}],outputs:[]}] as const;
  const transfer = await wallet.writeContract({address,abi:transferAbi,functionName:'safeTransferFrom',args:[account.address,signer.address,1n,1n,'0x']});
  await client.waitForTransactionReceipt({hash:transfer});
  assert.equal((await inspect(row,[attempt])).state,'success');
  const nonceBefore = await client.getTransactionCount({address:account.address});
  assert.equal((await inspect(row,[attempt])).state,'success');
  assert.equal(await client.getTransactionCount({address:account.address}),nonceBefore);
  const absent = await inspect({...row,status:'unknown',order_id:keccak256(stringToHex('never-sent')),tx_hash:null},[]);
  assert.equal(absent.state,'pending');
  const revertResponse=await fetch('http://127.0.0.1:8547',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:2,method:'evm_revert',params:[snapshot]})});
  assert.equal((await revertResponse.json() as {result:boolean}).result,true);
  const reorganized=await inspect({...row,status:'success'},[attempt]); assert.equal(reorganized.state,'confirming');
  const root='reviews/evidence/parallel-2026-10/20261002-night-01/p17/pipeline';mkdirSync(root,{recursive:true});
  writeFileSync(`${root}/local-recovery.json`,JSON.stringify({chainId:31337,scope:'有界非生产测试harness，非产品发行政策',deployment,
    address,mint:hash,block:String(receipt.blockNumber),result,recovered,transfer,unknown:absent,reorganized,
    assertions:['真实回执/双事件/链与calldata/历史attempt','丢hash通过order事件恢复','拒签/未上报历史凭证以真实链结果恢复','错误recipient拒绝','转出不推翻历史mint','重复inspect不发送/nonce不变','未知不释放/不补发','重组后回退confirming'],
    database:'未连接，真实事务/RLS/竞争仍待外部隔离数据库'},null,2)+'\n');
  console.log('PASS 31337真实回执/事件/丢hash恢复/recipient/转出/unknown无重发；数据库验收未执行');
}
main().catch((error)=>{console.error('P17本地恢复失败',error instanceof Error?error.message:error);process.exitCode=1;});
