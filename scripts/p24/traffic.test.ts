import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOfflineModule } from '../p14-j/offline-module';

type Identity = { userId: string; wallet: null; getToken(): Promise<string> };
type Cache = { loadMintStatus(id: Identity, force?: boolean): Promise<void>; clearMintCache(): void;
  mintReadFailed(id: Identity): boolean; opCache: { get(user: string, track: string): unknown } };
const identity = (userId: string): Identity => ({ userId, wallet: null, getToken: async () => userId });
const success = () => Response.json({ op: { song: null }, orders: [] });
function cache(fetch: () => Promise<Response>) {
  const delays: number[] = [];
  const c = loadOfflineModule<Cache>('src/components/music-catalog/claim/mint-status-cache.ts',{
    '../../../features/material-catalog/mint/order-model': {}, '../../../lib/music-catalog/asset-registry': {},
    '../../../lib/fetch-with-auth': { fetchWithAuth: fetch },
  },{ setTimeout: (_cb: unknown, ms: number) => { delays.push(ms); return 1; }, clearTimeout: () => undefined });
  return { c, delays };
}
test('切换账号时丢弃旧请求，未知和未收藏分开', async () => {
  let complete!: (r: Response) => void;
  let calls = 0;
  const { c } = cache(() => ++calls === 1 ? new Promise(r => { complete = r; }) : Promise.resolve(success()));
  const a = identity('a'), b = identity('b');
  const old = c.loadMintStatus(a);
  await new Promise<void>(done => setImmediate(done));
  await c.loadMintStatus(b);
  complete(success()); await old;
  assert.equal(c.opCache.get('a','song'), undefined);
  assert.equal((c.opCache.get('b','song') as {status:unknown}).status,null);
});
test('503保留旧值，429重试遵守服务端时间并只安排一次，401不安排', async () => {
  const id = identity('a');
  const replies = [success(),new Response(null,{status:429,headers:{'Retry-After':'41'}}),new Response(null,{status:503})];
  const { c, delays } = cache(async () => replies.shift()!);
  await c.loadMintStatus(id); await c.loadMintStatus(id,true); await c.loadMintStatus(id,true);
  assert.deepEqual(delays,[41000]); assert.equal(c.mintReadFailed(id),true);
  assert.equal((c.opCache.get('a','song') as {status:unknown}).status,null);
  const auth = cache(async()=>new Response(null,{status:401}));
  await auth.c.loadMintStatus(id); assert.deepEqual(auth.delays,[]);
});
test('收藏刷新碰上在途读取时只补一次', async () => {
  let complete!: (r: Response) => void;
  let calls = 0;
  const { c } = cache(async () => ++calls === 1 ? new Promise(r => { complete = r; }) : success());
  const id = identity('a'), old = c.loadMintStatus(id);
  await new Promise<void>(done => setImmediate(done));
  const many = [c.loadMintStatus(id,true),c.loadMintStatus(id,true)];
  complete(success()); await Promise.all([old,...many]);
  assert.equal(calls,2);
});
test('并发预留每日十份额度，Redis出错时草稿放行且短信拒绝', async () => {
  const counts = new Map<string,number>(); let fail = false;
  const redis = {eval: async (script: string, [key]: string[], args: number[]) => {
    if (fail) throw Error('服务失联');
    const count=counts.get(key) ?? 0;
    if(script.includes('DECR')) {counts.set(key,count-1);return 1;}
    assert.ok(script.includes('INCR') && script.includes('EXPIRE'));
    if(count>=args[0])return 0;
    counts.set(key,count+1);return 1;
  }};
  type Ticket = { allowed: boolean; refund?: () => Promise<void> };
  const {takeQuota} = loadOfflineModule<{takeQuota:(name:string,max:number,window:number,open:boolean)=>Promise<Ticket>}>(
    'src/lib/rate-limit/quota.ts',{'@upstash/redis':{Redis:{fromEnv:()=>redis}}},{process:{env:{}},console:{error:()=>undefined}});
  const batch=await Promise.all(Array.from({length:40},()=>takeQuota('score:a',10,86400,true)));
  assert.equal(batch.filter(t=>t.allowed).length,10);
  await batch[0].refund?.();assert.equal((await takeQuota('score:a',10,86400,true)).allowed,true);
  fail=true;assert.equal((await takeQuota('draft',60,3600,true)).allowed,true);
  assert.equal((await takeQuota('sms',500,86400,false)).allowed,false);
});
test('投递失败可以重试，按类别分开去重，并发同类只发一次', async () => {
  const kv = new Map<string,string>(); let sends=0; let ok=false;
  const redis={get:async(k:string)=>kv.get(k),set:async(k:string,v:string,o:{nx?:boolean})=>{
    if(o.nx && kv.has(k))return null;kv.set(k,v);return 'OK';
  },eval:async(_s:string,[k]:string[],[v]:string[])=>{if(kv.get(k)===v)kv.delete(k);}};
  const {notifyOnce}=loadOfflineModule<{notifyOnce:(q:string,k:string,s:string,b:string)=>Promise<boolean>}>(
    'src/lib/alerts/once.ts',{'@upstash/redis':{Redis:{fromEnv:()=>redis}},'node:crypto':{randomUUID:()=>String(Math.random())},
      './resend':{sendAlert:async()=>{sends++;return ok;}}},{process:{env:{}}});
  assert.equal(await notifyOnce('score','balance','s','b'),false);
  ok=true;await Promise.all(Array.from({length:3},()=>notifyOnce('score','balance','s','b')));
  await notifyOnce('score','backlog','s','b');assert.equal(sends,3);
});
