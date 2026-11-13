import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOfflineModule } from '../p14-j/offline-module';

test('开包先找已成功 Score，大量未就绪意图和第一张失败不会挡住它', async () => {
  const intent = (id: string) => ({ pending_score_id:id,user_id:'u',created_at:new Date().toISOString() });
  const promoted: string[] = [], dropped: string[] = [];
  const db = { from(table: string) {
    let ready = false, id = '', deleting = false;
    const q = {
      select(cols:string){ ready = cols.includes('!inner'); return q; }, order(){return q;},
      eq(k:string,v:string){if(k==='pending_score_id')id=v;return q;},
      limit(){return Promise.resolve({data:ready?[intent('ready')]:[intent('failed'),intent('later')],error:null});},
      maybeSingle(){return Promise.resolve({data:{status:id==='ready'?'success':id==='failed'?'failed':'pending',token_id:1},error:null});},
      delete(){deleting=true;return q;},
      then(done:(r:unknown)=>void){if(deleting && table==='score_pack_intents')dropped.push(id);done({error:null});},
    };return q;
  }};
  const {promoteOpIntents}=loadOfflineModule<{promoteOpIntents(n:number):Promise<{promoted:number}>}>(
    'app/api/cron/process-score-pack/intents.ts',{viem:{getAddress:(s:string)=>s},'@/src/lib/chain/multichain/registry':{getConfiguredScoreAddress:()=> '0x01'},
      '@/src/lib/chain/chain-config':{CHAIN_ID_NUM:10},'@/src/lib/score-pack/chain':{readScoreOwner:async()=>'0x02'},
      '@/src/lib/score-pack/issue':{PackIssueError:Error,requestSponsoredPack:async()=>{promoted.push('ready');}},
      '@/src/lib/score-pack/redact':{},'@/src/lib/supabase':{supabaseAdmin:db}});
  assert.equal((await promoteOpIntents(2)).promoted,1);
  assert.deepEqual(promoted,['ready']);assert.deepEqual(dropped,['ready','failed']);
});
test('开包五单共享一个截止时间，后四单预算不足就停', async () => {
  let now=0, sent=0;
  const db={from(){const q={select(){return q;},in(){return q;},order(){return q;},limit(){return q;},or(){return q;},eq(){return q;},
    then(done:(r:unknown)=>unknown){return Promise.resolve(done({data:Array(5).fill({}),error:null}));}};return q;}};
  const {runScorePackCycle}=loadOfflineModule<{runScorePackCycle(o:object):Promise<unknown>}>(
    'app/api/cron/process-score-pack/cycle.ts',{'node:crypto':{randomUUID:()=> 'owner'},
      '@/src/lib/supabase':{supabaseAdmin:db},'./intents':{promoteOpIntents:async()=>({})},
      './steps':{reconcileOrder:async()=> 'waiting',sendSponsoredOrder:async()=>{now+=11000;sent++;return 'sent';}}},
    {Date:class extends Date{static now(){return now;}}});
  await runScorePackCycle({batch:5,deadline:25000});
  assert.equal(sent,1);
});
test('未收到广播回执，慢发送中按 holder 续锁；定时器与锁均被释放', async () => {
  let beats=0, releases=0, interval=0, cleaned=false;
  let pulse!:()=>void;
  const {broadcastOperator}=loadOfflineModule<{broadcastOperator:(a:string,j:unknown,d:number)=>Promise<string>}>(
    'src/lib/chain/broadcast/operator.ts',{'server-only':{},'node:crypto':{randomUUID:()=> 'worker'},
      '@upstash/redis':{Redis:{fromEnv:()=>({})}},'../operator-lock':{acquireOpLock:async()=>true,
        heartbeatOpLock:async()=>{beats++;return true;},releaseOpLock:async()=>{releases++;}},
      '../public-client':{publicClient:{chain:{id:10}}},'../../alerts/once':{},
      './protocol':{safeBroadcast:async()=>{for(let i=0;i<5;i++)pulse();return 'sent';}}},
    {setInterval:(cb:()=>void,ms:number)=>{pulse=cb;interval=ms;return 1;},clearInterval:()=>{cleaned=true;}});
  assert.equal(await broadcastOperator('0x01',{},Date.now()+25000),'sent');
  assert.equal(interval,30000);assert.equal(beats,5);assert.equal(releases,1);assert.equal(cleaned,true);
});
