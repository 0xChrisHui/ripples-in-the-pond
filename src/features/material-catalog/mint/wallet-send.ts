'use client';
import { createPublicClient, createWalletClient, custom, encodeFunctionData, getAddress, http, keccak256, stringToHex, type Hex,
  type Address } from 'viem';
import type { ConnectedWallet } from '@privy-io/react-auth';
import { mainnet, sepolia } from 'viem/chains';
import { getMusicCatalog, getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import { MATERIAL_ABI, hashMaterialAuthorization, type MaterialAuthorization } from '../../../lib/material-mint/contract';
export type MaterialVoucher = {
  orderId: Hex; trackId: string; chainId: 1 | 11155111; contractAddress: Address; recipientAddress: Address;
  metadataUri: string; catalogRevision: string; digest: Hex; signature: Hex; authorizer: Address; version: number;
  authorization: Omit<MaterialAuthorization, 'tokenId' | 'amount' | 'deadline'> & { tokenId: string; amount: string; deadline: string };
};
export function validateMaterialVoucher(voucher: MaterialVoucher, account: Address): MaterialAuthorization {
  const deployment = getOriginalDeployment(voucher.trackId, voucher.chainId), catalog = getMusicCatalog();
  if (!deployment || deployment.status !== 'ready' || !deployment.contractAddress || !deployment.metadataUri
    || getAddress(deployment.contractAddress) !== getAddress(voucher.contractAddress)
    || catalog.revision !== voucher.catalogRevision || deployment.metadataUri !== voucher.metadataUri) throw new Error('原曲发行/永久资料与目录不一致');
  const a = { ...voucher.authorization, tokenId: BigInt(voucher.authorization.tokenId), amount: BigInt(voucher.authorization.amount),
    recipient: getAddress(voucher.authorization.recipient), deadline: BigInt(voucher.authorization.deadline) };
  if (getAddress(voucher.recipientAddress) !== account || a.recipient !== account || a.orderId !== voucher.orderId
    || a.amount !== 1n || String(a.tokenId) !== deployment.tokenId || a.tokenURIHash !== keccak256(stringToHex(voucher.metadataUri))
    || a.deadline < BigInt(Math.floor(Date.now() / 1000)) || hashMaterialAuthorization(voucher.chainId, voucher.contractAddress, a) !== voucher.digest) {
    throw new Error('原曲凭证身份/接收地址/hash不一致');
  }
  return a;
}
function rejected(error: unknown) {
  let current = error;
  for (let depth=0;depth<5 && current && typeof current === 'object';depth++) {
    const value = current as {code?:unknown;cause?:unknown}; if (value.code===4001 || value.code==='4001') return true; current=value.cause;
  }
  return false;
}
export async function sendMaterialVoucher(voucher: MaterialVoucher, selected: Pick<ConnectedWallet,'address'|'switchChain'|'getEthereumProvider'>, state: {
    attempt:()=>Promise<void>; outcome:(result:'rejected'|'unknown')=>Promise<void>;
    submission:(hash:Hex)=>Promise<void>; remember:(hash:Hex)=>void; forget:()=>void;
  }) {
  const account = getAddress(selected.address), a = validateMaterialVoucher(voucher,account);
  await selected.switchChain(voucher.chainId);
  const provider = await selected.getEthereumProvider();
  if (Number(await provider.request({method:'eth_chainId'}))!==voucher.chainId) throw new Error('钱包网络未切换');
  const accounts = await provider.request({method:'eth_accounts'});
  if (!Array.isArray(accounts) || !accounts.some((address:unknown)=>getAddress(String(address))===account)) throw new Error('钱包付款账户发生变化');
  const chain = voucher.chainId===1?mainnet:sepolia;
  const publicClient = createPublicClient({chain,transport:http()});
  const args = [a,voucher.authorizer,voucher.signature] as const;
  await publicClient.simulateContract({address:voucher.contractAddress,abi:MATERIAL_ABI,functionName:'redeem',args,account});
  const [gas,gasPrice,balance] = await Promise.all([publicClient.estimateContractGas({address:voucher.contractAddress,abi:MATERIAL_ABI,
    functionName:'redeem',args,account}),publicClient.getGasPrice(),publicClient.getBalance({address:account})]);
  const gasLimit=gas*120n/100n; if(balance<gasLimit*gasPrice) throw new Error('ETH不足以支付保守Gas估算');
  // 钱包弹窗前原子占用attempt；无hash未知不得再次调用发送。
  await state.attempt(); let hash:Hex;
  try {
    const wallet=createWalletClient({account,chain,transport:custom(provider)});
    hash=await wallet.sendTransaction({account,chain,to:voucher.contractAddress,value:0n,gas:gasLimit,
      data:encodeFunctionData({abi:MATERIAL_ABI,functionName:'redeem',args})});
  } catch(error) {
    await state.outcome(rejected(error)?'rejected':'unknown').catch((failure)=>console.error('原曲attempt需后台恢复',failure)); throw error;
  }
  try { state.remember(hash); } catch(error) { console.error('原曲本地恢复缓存不可写，立即向服务器提交hash',error); }
  try { await state.submission(hash); state.forget(); }
  catch(error) { await state.outcome('unknown').catch((failure)=>console.error('原曲hash已缓存，需后台恢复',failure)); throw error; }
  return hash;
}
