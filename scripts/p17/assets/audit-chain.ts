import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createPublicClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { resolveErc1155Uri } from '../../../src/lib/music-catalog/identity';
import { WALLET_RECIPE_GATEWAYS } from '../../../src/lib/wallet-recipe/gateways';
import { safePermanentFetch } from '../../../src/lib/music-catalog/permanent';
async function main() {
  const catalog=getMusicCatalog(),address=catalog.collections.find((row)=>row.kind==='original')!.contractAddress as `0x${string}`;
  const reuse=process.argv.includes('--media-only') ? JSON.parse(readFileSync('reviews/evidence/parallel-2026-10/20261002-night-01/p17/inventory/op-chain-proof.json','utf8')) as {
    chainId:number;blockNumber:string;codePresent:boolean;erc1155:boolean;uriFrozen:boolean;
    results:{trackId:string;metadataUri:string}[] } : null;
  const client=createPublicClient({chain:optimism,transport:http('https://mainnet.optimism.io',{timeout:10000,retryCount:1}),batch:{multicall:true}});
  const chainId=reuse?.chainId ?? await client.getChainId(); if(chainId!==10) throw new Error('公开RPC网络不符');
  const blockNumber=reuse?BigInt(reuse.blockNumber):await client.getBlockNumber();
  const abi=parseAbi(['function supportsInterface(bytes4 id) view returns(bool)','function uriFrozen() view returns(bool)',
    'function uri(uint256 id) view returns(string)']);
  const [codePresent,standard,frozen]=reuse?[reuse.codePresent,reuse.erc1155,reuse.uriFrozen]:await Promise.all([
    client.getBytecode({address,blockNumber}).then((code)=>Boolean(code && code!=='0x')),client.readContract({address,abi,functionName:'supportsInterface',
    args:['0xd9b67a26'],blockNumber}),client.readContract({address,abi,functionName:'uriFrozen',blockNumber})]);
  const proof=JSON.parse(readFileSync('reviews/evidence/parallel-2026-10/20261002-night-01/p17/inventory/permanent-proof.json','utf8')) as {
    results:{trackId:string;metadataMatch:boolean;localBytes:number}[]};
  let index=0; const results:unknown[]=[];
  async function worker() {
    while(index<catalog.tracks.length) {
      const track=catalog.tracks[index++],deployment=track.deployments.find((item)=>item.chainId===10)!;
      const uri=reuse?reuse.results.find((item)=>item.trackId===track.trackId)!.metadataUri:
        await client.readContract({address,abi,functionName:'uri',args:[BigInt(deployment.tokenId!)],blockNumber});
      const expected=resolveErc1155Uri(uri,deployment.tokenId!);
      let mediaSourceReachable=false,contentType:string|null=null,contentLength:string|null=null,gateway:string|null=null;
      const permanent=proof.results.find((item)=>item.trackId===track.trackId)!;
      // 只HEAD验证真实音频来源可访问，不重复下载35份媒体，不冒充字节hash证明。
      for(const candidate of WALLET_RECIPE_GATEWAYS) {
        try {
          const response=await safePermanentFetch(`${candidate}/${track.audioArUri!.slice(5)}`,'HEAD',AbortSignal.timeout(6000));
          contentType=response.headers.get('content-type'); contentLength=response.headers.get('content-length');
          if(response.ok && contentType?.startsWith('audio/') && (contentLength===null || Number(contentLength)===permanent.localBytes)) {
            mediaSourceReachable=true;gateway=candidate;break;
          }
        } catch { /* 单网关失败只影响来源可达级别，不重传。 */ }
      }
      results.push({trackId:track.trackId,chainId,contractAddress:address,tokenId:deployment.tokenId,metadataUri:expected,
        uriMatch:expected===deployment.metadataUri,metadataMatch:permanent.metadataMatch,
        mediaSourceReachable,contentType,contentLength,gateway,canonicalAudioHash:null});
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  const root='reviews/evidence/parallel-2026-10/20261002-night-01/p17/inventory';mkdirSync(root,{recursive:true});
  writeFileSync(`${root}/op-chain-proof.json`,JSON.stringify({checkedAt:new Date().toISOString(),chainId,blockNumber:String(blockNumber),
    codePresent,erc1155:standard,uriFrozen:frozen,revision:catalog.revision,
    mediaLevel:'HEAD及永久metadata/真实数据库来源对应，不是canonical字节hash',results},null,2)+'\n');
  console.log(`OP只读身份/URI/metadata/音频来源：${results.length}项，区块${blockNumber}，无交易、无重复媒体下载`);
}
main().catch((error)=>{console.error('OP只读核验未完成',error instanceof Error?error.message:error);process.exitCode=1;});
